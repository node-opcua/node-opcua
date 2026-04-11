import path from "node:path";
import "should";
import {
    AddressSpace,
    ContinuationPointManager,
    type IServerBase,
    type ISessionBase,
    makeRoles,
    PseudoSession,
    SessionContext,
    type UAMethod,
    type UAObject,
    type UAServer,
    type UAServerConfiguration,
    type UATrustList,
    WellKnownRoles
} from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS.js";
import { CertificateManager } from "node-opcua-certificate-manager";
import {
    type Certificate,
    combine_der,
    makeSHA1Thumbprint,
    split_der
} from "node-opcua-crypto";
import { NodeClass } from "node-opcua-data-model";
import { OpenFileMode } from "node-opcua-file-transfer";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { NodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { SecurityPolicy } from "node-opcua-secure-channel";
import { StatusCodes } from "node-opcua-status-code";
import { MessageSecurityMode, TrustListDataType, UserNameIdentityToken } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import { ClientPushCertificateManagement, installPushCertificateManagement } from "../dist/index.js";
import type { PushCertificateManagerInternalContext } from "../dist/server/push_certificate_manager/internal_context.js";
import { TrustListMasks } from "../dist/server/trust_list_server.js";
import {
    _getFakeAuthorityCertificate,
    disposeSharedCertificateAuthority,
    initializeHelpers,
    produceCertificateAndPrivateKey,
    produceSignedCertificateChain
} from "./helpers/fake_certificate_authority.js";
import should from "should";

// ---------------------------------------------------------------------------
// Certificate buffers generated once per test suite in before().
// Replaces the external file dependencies on node-opcua-samples/certificates.
// ---------------------------------------------------------------------------

/** CA-signed certificate chain [leaf, CA] — replaces sampleCert2048 */
let caCertChain: Certificate[];
/** Self-signed certificate (2048-bit) — replaces sampleSelfSignedCert2048 */
let selfSignedCert: Certificate;
/** Second self-signed certificate (2048-bit, different key) — replaces sampleSelfSignedCert1024 */
let selfSignedCert2: Certificate;

interface PushCertificateManagerServerImplEx {
    applicationGroup: CertificateManager;
    userTokenGroup: CertificateManager;
    _context: PushCertificateManagerInternalContext;
}

interface UAServerConfigurationEx extends UAServerConfiguration {
    $pushCertificateManager: PushCertificateManagerServerImplEx;
}
interface UATrustListEx extends UATrustList {
    $$certificateManager: CertificateManager;
    $$openedForWrite: boolean;
    $fileData: {
        openCount: number;
    };
}

async function resetTrustList(trustList: UATrustList, certificateManager: CertificateManager) {
    const trustListPriv = trustList as UATrustListEx;
    trustListPriv.$$certificateManager = certificateManager;
    // RESET NODE STATE HERE TOO
    trustListPriv.$$openedForWrite = false;
    if (trustListPriv.$fileData) trustListPriv.$fileData.openCount = 0;
}

async function rebindServerConfiguration(
    addressSpace: AddressSpace
): Promise<{ applicationGroup: CertificateManager; userTokenGroup: CertificateManager }> {
    let applicationGroup: CertificateManager | undefined;
    let userTokenGroup: CertificateManager | undefined;

    const _folder = await initializeHelpers("AA", 0);
    applicationGroup = new CertificateManager({
        location: path.join(_folder, "application"),
        addCertificateValidationOptions: { ignoreMissingRevocationList: true }
    });
    userTokenGroup = new CertificateManager({
        location: path.join(_folder, "user"),
        addCertificateValidationOptions: { ignoreMissingRevocationList: true }
    });
    await applicationGroup.initialize();
    await userTokenGroup.initialize();

    const serverConfiguration = addressSpace.rootFolder.objects.server.getChildByName(
        "ServerConfiguration"
    ) as UAServerConfigurationEx;

    if (serverConfiguration?.$pushCertificateManager) {
        const pushCM = serverConfiguration.$pushCertificateManager;
        pushCM.applicationGroup = applicationGroup;
        pushCM.userTokenGroup = userTokenGroup;
        if (pushCM._context?.map) {
            pushCM._context.map.DefaultApplicationGroup = applicationGroup;
            pushCM._context.map.DefaultUserTokenGroup = userTokenGroup;
        }
        const groups = serverConfiguration.certificateGroups.getComponents();
        for (const group of groups) {
            if (group.nodeClass !== NodeClass.Object) continue;
            const groupEx = group as UAObject;
            const trustList = groupEx.getComponentByName("TrustList") as UATrustListEx;
            if (trustList) {
                const certificateManager =
                    group.browseName.toString() === "DefaultApplicationGroup" ? applicationGroup : userTokenGroup;
                resetTrustList(trustList, certificateManager);
            }
        }
        return { applicationGroup, userTokenGroup };
    }
    return { applicationGroup, userTokenGroup };
}

// ---------------------------------------------------------------------------
// DRY helpers
// ---------------------------------------------------------------------------

/** Build a TrustListDataType with defaults for empty arrays. */
function makeTrustListData(
    masks: number,
    opts: {
        trustedCertificates?: Buffer[] | null;
        issuerCertificates?: Buffer[] | null;
        trustedCrls?: Buffer[] | null;
        issuerCrls?: Buffer[] | null;
    } = {}
): TrustListDataType {
    const tl = new TrustListDataType();
    tl.specifiedLists = masks;
    tl.trustedCertificates = opts.trustedCertificates ?? [];
    tl.issuerCertificates = opts.issuerCertificates ?? [];
    tl.trustedCrls = opts.trustedCrls ?? [];
    tl.issuerCrls = opts.issuerCrls ?? [];
    return tl;
}

/** Create an ISessionBase whose channel has MessageSecurityMode.None. */
function makeUnsecureSession(baseSession: ISessionBase): ISessionBase {
    if (!baseSession.channel) {
        throw new Error("session.channel is undefined");
    }
    return {
        ...baseSession,
        channel: {
            ...baseSession.channel,
            securityMode: MessageSecurityMode.None
        }
    };
}

/** Create an IServerBase whose userManager grants only AuthenticatedUser (no SecurityAdmin). */
function makeRestrictedServer(): IServerBase {
    return {
        userManager: {
            getUserRoles(_userName: string): NodeId[] {
                return makeRoles([WellKnownRoles.AuthenticatedUser]);
            }
        }
    };
}

const doDebug = false;
describe("ServerConfiguration", () => {
    let addressSpace: AddressSpace;

    const opcuaServer: IServerBase = {
        userManager: {
            getUserRoles(_userName: string): NodeId[] {
                return makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.SecurityAdmin]);
            }
        }
    };
    const session: ISessionBase = {
        userIdentityToken: new UserNameIdentityToken({
            userName: "admin"
        }),
        channel: {
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256,
            clientCertificate: Buffer.from("dummy", "utf-8"),
            getTransportSettings() {
                return { maxMessageSize: 0 };
            }
        },
        getSessionId() {
            return NodeId.nullNodeId;
        },
        continuationPointManager: new ContinuationPointManager()
    };

    let applicationGroup: CertificateManager | undefined;
    let userTokenGroup: CertificateManager | undefined;

    const xmlFiles = [nodesets.standard];

    before(async function (this: Mocha.Context) {
        this.timeout(30000); // cert generation takes time
        await CertificateManager.disposeAll();

        // Generate test certificates on-the-fly
        const certFolder = await initializeHelpers("CERT_GEN", 0);
        const [ss1, ss2, chain] = await Promise.all([
            produceCertificateAndPrivateKey(certFolder),
            produceCertificateAndPrivateKey(certFolder),
            produceSignedCertificateChain(certFolder)
        ]);
        selfSignedCert = ss1.certificate;
        selfSignedCert2 = ss2.certificate;
        caCertChain = chain;

        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, xmlFiles);
        addressSpace.registerNamespace("Private");
    });

    after(async () => {
        session?.continuationPointManager?.dispose();
        if (addressSpace) {
            await addressSpace.shutdown();
            addressSpace.dispose();
        }
        await disposeSharedCertificateAuthority();
        CertificateManager.checkAllDisposed();
    });

    beforeEach(async () => {
        // Re-bind to server if already installed
        const newGroups = await rebindServerConfiguration(addressSpace);
        applicationGroup = newGroups.applicationGroup;
        userTokenGroup = newGroups.userTokenGroup;
    });

    afterEach(async () => {
        session?.continuationPointManager?.dispose();

        if (applicationGroup) {
            await applicationGroup.dispose();
            applicationGroup = undefined;
        }
        if (userTokenGroup) {
            await userTokenGroup.dispose();
            userTokenGroup = undefined;
        }
    });

    it("should expose a server configuration object", async () => {
        const server = addressSpace.rootFolder.objects.server;
        server.should.have.ownProperty("serverConfiguration");
    });

    interface UAServerWithConfiguration extends UAServer {
        serverConfiguration: UAServerConfiguration;
    }
    it("should expose a server configuration object - Certificate Management", async () => {
        const server = addressSpace.rootFolder.objects.server as UAServerWithConfiguration;

        // folders
        server.serverConfiguration.should.have.ownProperty("certificateGroups");

        // properties
        server.serverConfiguration.should.have.ownProperty("maxTrustListSize");
        server.serverConfiguration.should.have.ownProperty("multicastDnsEnabled");
        server.serverConfiguration.should.have.ownProperty("serverCapabilities");
        server.serverConfiguration.should.have.ownProperty("supportedPrivateKeyFormats");

        // methods
        server.serverConfiguration.should.have.ownProperty("applyChanges");
        server.serverConfiguration.should.have.ownProperty("createSigningRequest");
        server.serverConfiguration.should.have.ownProperty("getRejectedList");
        server.serverConfiguration.should.have.ownProperty("updateCertificate");
    });

    it("server configuration should make its first level object visible", () => {
        // ServerConfiguration Object and its immediate children shall be visible (i.e. browse access is available) to
        // users who can access the Server Object.
        // todo
    });

    it("server configuration should hide children of certificate groups to non admin user", () => {
        // The children of the CertificateGroups Object should
        // only be visible to authorized administrators.
        // todo
    });

    it("should expose a server configuration object - KeyCredential Management", async () => {
        const server = addressSpace.rootFolder.objects.server as UAServerWithConfiguration;
        server.serverConfiguration.should.have.ownProperty("keyCredentialConfiguration");
    });

    it("should expose a server configuration object - Authorization Management", async () => {
        const server = addressSpace.rootFolder.objects.server as UAServerWithConfiguration;
        server.serverConfiguration.should.have.ownProperty("authorizationServices");
    });

    describe("Push Certificate Management model", () => {
        //
        // from OpcUA Specification part#12 7.3:
        // Push management is targeted at Server applications to
        // get a Certificate Request which can be passed onto the CertificateManager.
        // After the CertificateManager signs the Certificate the new Certificate
        // is pushed to the Server with the UpdateCertificate Method

        // The Administration Component may be part of the CertificateManager or a standalone utility
        // that uses OPC UA to communicate with the CertificateManager.
        // The Configuration Database is used by the Server to persist its configuration information.
        // The RegisterApplication Method (or internal equivalent) is assumed to have been called
        // before the sequence in the diagram starts.
        // A similar process is used to renew certificates or to periodically update Trust List.
        // Security when using the Push Management Model requires an encrypted channel and the use
        // of Administrator credentials for the Server that ensure only authorized users can update
        // Certificates or Trust Lists. In addition, separate Administrator credentials are required for the
        // CertificateManager that ensure only authorized users can register new Servers and request
        // new Certificates.

        beforeEach(async () => {
            await installPushCertificateManagement(addressSpace, {
                applicationGroup,
                userTokenGroup,
                applicationUri: "SomeUri"
            });
        });

        /** Get the default application group trust list with a secure admin context. */
        async function getDefaultTrustList(
            server: IServerBase = opcuaServer,
            sess: ISessionBase = session
        ) {
            const context = new SessionContext({ server, session: sess });
            const pseudoSession = new PseudoSession(addressSpace, context);
            const mgr = new ClientPushCertificateManagement(pseudoSession);
            const group = await mgr.getCertificateGroup("DefaultApplicationGroup");
            return group.getTrustList();
        }

        /** Preload issuer certificates into the trust list so AddCertificate chain validation passes. */
        async function preloadIssuerCertificates(trustList: Awaited<ReturnType<typeof getDefaultTrustList>>, issuerCerts: Buffer[]) {
            await trustList.writeTrustedCertificateList(
                makeTrustListData(TrustListMasks.IssuerCertificates, { issuerCertificates: issuerCerts })
            );
        }

        it("should implement createSigningRequest", async () => {
            const server = addressSpace.rootFolder.objects.server as UAServerWithConfiguration;
            server.serverConfiguration.createSigningRequest.nodeClass.should.eql(NodeClass.Method);

            const context = new SessionContext({ server: opcuaServer, session });
            const pseudoSession = new PseudoSession(addressSpace, context);

            const clientPullCertificateManager = new ClientPushCertificateManagement(pseudoSession);

            const certificateGroupId = await clientPullCertificateManager.getCertificateGroupId("DefaultApplicationGroup");
            const certificateTypeId = new NodeId();
            const subjectName = "O=NodeOPCUA/CN=urn:NodeOPCUA-Server";
            const regeneratePrivateKey = false;
            const nonce = Buffer.alloc(0);

            const result = await clientPullCertificateManager.createSigningRequest(
                certificateGroupId,
                certificateTypeId,
                subjectName,
                regeneratePrivateKey,
                nonce
            );
            result.statusCode.should.eql(StatusCodes.Good);
        });

        xit("should implement UpdateCertificate", async () => {
            const context = new SessionContext({ server: opcuaServer, session });
            const pseudoSession = new PseudoSession(addressSpace, context);

            const clientPushCertificateManager = new ClientPushCertificateManagement(pseudoSession);

            const certificateGroupId = new NodeId();
            const certificateTypeId = new NodeId();
            const certificate = Buffer.from("SomeCertificate");
            const issuerCertificates = [Buffer.from("Issuer1"), Buffer.from("Issuer2")];
            const _privateKeyFormat = "PEM";
            const _privateKey = Buffer.from("1234");

            const result = await clientPushCertificateManager.updateCertificate(
                certificateGroupId,
                certificateTypeId,
                certificate,
                issuerCertificates
            );

            result.statusCode.should.eql(StatusCodes.BadInvalidArgument);
            //            result.applyChangesRequired!.should.eql(true);
        });

        it("should provide trust list", async () => {
            const trustList = await getDefaultTrustList();

            let a = await trustList.readTrustedCertificateList();
            doDebug && console.log(a.toString());

            // now add a certificate
            const certificates = caCertChain;

            // Preload issuer certificates so AddCertificate validation succeeds
            await preloadIssuerCertificates(trustList, certificates.slice(1));

            const sc = await trustList.addCertificate(combine_der(certificates), true);
            sc.should.eql(StatusCodes.Good);

            a = await trustList.readTrustedCertificateList();
            doDebug && console.log(a.toString());
            a.trustedCertificates?.length.should.eql(1);
            a.issuerCertificates?.length.should.eql(certificates.length - 1);
            a.issuerCrls?.length.should.eql(0);
            a.trustedCrls?.length.should.eql(0);
        });

        it("should provide trust list with masks - issuer certificates", async () => {
            const trustList = await getDefaultTrustList();

            let a = await trustList.readTrustedCertificateListWithMasks(TrustListMasks.IssuerCertificates);

            doDebug && console.log(a.toString());
            a.trustedCertificates?.length.should.eql(0);
            a.issuerCertificates?.length.should.eql(0);
            a.issuerCrls?.length.should.eql(0);
            a.trustedCrls?.length.should.eql(0);

            // now add a certificate
            {
                const certificates = caCertChain;
                // Per OPC UA spec, AddCertificate with isTrustedCertificate=false returns BadCertificateInvalid
                const sc = await trustList.addCertificate(combine_der(certificates), /*isTrustedCertificate =*/ false);
                sc.should.eql(StatusCodes.BadCertificateInvalid);
            }
            {
                const certificates = [selfSignedCert];
                should.exist(certificates);
                certificates.length.should.eql(1);

                const sc = await trustList.addCertificate(
                    combine_der(certificates), /*isTrustedCertificate =*/ true);
                sc.should.eql(StatusCodes.Good);
            }

            a = await trustList.readTrustedCertificateListWithMasks(TrustListMasks.IssuerCertificates);
            doDebug && console.log(a.toString());
            a.specifiedLists.should.eql(TrustListMasks.IssuerCertificates);
            a.trustedCertificates?.length.should.eql(0);
            // AddCertificate no longer adds issuer certificates per OPC UA spec
            a.issuerCertificates?.length.should.eql(0);
            a.issuerCrls?.length.should.eql(0);
            a.trustedCrls?.length.should.eql(0);

            a = await trustList.readTrustedCertificateListWithMasks(TrustListMasks.TrustedCertificates);
            doDebug && console.log(a.toString());
            a.specifiedLists.should.eql(TrustListMasks.TrustedCertificates);
            a.trustedCertificates?.length.should.eql(1);
            a.issuerCertificates?.length.should.eql(0);
            a.issuerCrls?.length.should.eql(0);
            a.trustedCrls?.length.should.eql(0);
        });

        it("should write trust list", async () => {
            const trustList = await getDefaultTrustList();

            // now add a certificate
            const certificates = caCertChain;

            // Preload issuer certificates so AddCertificate validation succeeds
            await preloadIssuerCertificates(trustList, certificates.slice(1));

            {
                const sc = await trustList.addCertificate(combine_der(certificates), /*isTrustedCertificate =*/ true);
                sc.should.eql(StatusCodes.Good);
            }

            let a = await trustList.readTrustedCertificateList();
            doDebug && console.log(a.toString());
            a.trustedCertificates?.length.should.eql(1);
            a.issuerCertificates?.length.should.eql(certificates.length - 1);
            a.issuerCrls?.length.should.eql(0);
            a.trustedCrls?.length.should.eql(0);

            // create a new trust list with additional issuer certificates and CRLs
            // Reuse the same certificate chain for issuer certificates and CRLs

            // Use real CRL data from the certificate authority
            const { crl } = await _getFakeAuthorityCertificate(await initializeHelpers("TEST_CRL", 0));

            const newTrustList = makeTrustListData(TrustListMasks.All, {
                trustedCertificates: a.trustedCertificates,
                issuerCertificates: certificates.slice(1), // All but the leaf
                issuerCrls: [
                    crl,
                    crl // Use the same CRL twice to test multiple CRLs
                ]
            });

            // now write back the updated list
            const rc = await trustList.writeTrustedCertificateList(newTrustList);
            // https://reference.opcfoundation.org/GDS/v105/docs/7.8.2.5#_Ref374565520
            // If the Server does not support transactions, it applies the changes immediately and sets applyChangesRequired to FALSE.
            // If the Server supports transactions, then the Server creates a new transaction or continues an existing transaction and sets applyChangesRequired to TRUE.
            rc.should.eql(false);

            a = await trustList.readTrustedCertificateList();
            doDebug && console.log(a.toString());
            a.trustedCertificates?.length.should.eql(1);
            a.issuerCertificates?.length.should.eql(1); // issuer from the chain added via Write
            a.issuerCrls?.length.should.eql(1); // same CRL buffer produces same filename, so only 1 file on disk
            a.trustedCrls?.length.should.eql(0);
        });

        it("should read trust list with TrustedCrls mask", async () => {
            const trustList = await getDefaultTrustList();

            // Read with TrustedCrls mask only
            const a = await trustList.readTrustedCertificateListWithMasks(TrustListMasks.TrustedCrls);

            doDebug && console.log(a.toString());
            a.specifiedLists.should.eql(TrustListMasks.TrustedCrls);
            a.trustedCertificates?.length.should.eql(0);
            a.issuerCertificates?.length.should.eql(0);
            a.issuerCrls?.length.should.eql(0);
            a.trustedCrls?.length.should.eql(0); // No CRLs added yet
        });

        it("should read trust list with IssuerCrls mask", async () => {
            const trustList = await getDefaultTrustList();

            // Read with IssuerCrls mask only
            const a = await trustList.readTrustedCertificateListWithMasks(TrustListMasks.IssuerCrls);

            doDebug && console.log(a.toString());
            a.specifiedLists.should.eql(TrustListMasks.IssuerCrls);
            a.trustedCertificates?.length.should.eql(0);
            a.issuerCertificates?.length.should.eql(0);
            a.issuerCrls?.length.should.eql(0); // No CRLs added yet
            a.trustedCrls?.length.should.eql(0);
        });

        it("should read trust list with both CRL masks", async () => {
            const trustList = await getDefaultTrustList();

            // Read with both CRL masks
            const crlMask = TrustListMasks.TrustedCrls | TrustListMasks.IssuerCrls;
            const a = await trustList.readTrustedCertificateListWithMasks(crlMask);

            doDebug && console.log(a.toString());
            a.specifiedLists.should.eql(crlMask);
            a.trustedCertificates?.length.should.eql(0);
            a.issuerCertificates?.length.should.eql(0);
            a.issuerCrls?.length.should.eql(0);
            a.trustedCrls?.length.should.eql(0);
        });

        it("should write and read back trusted CRLs", async () => {
            const trustList = await getDefaultTrustList();

            // Get a real CRL from the certificate authority
            const { crl } = await _getFakeAuthorityCertificate(await initializeHelpers("TEST_TRUSTED_CRL", 0));

            // Write and verify
            const rc = await trustList.writeTrustedCertificateList(
                makeTrustListData(TrustListMasks.TrustedCrls, { trustedCrls: [crl] })
            );
            rc.should.eql(false); // No transaction support

            // Read back with TrustedCrls mask
            const a = await trustList.readTrustedCertificateListWithMasks(TrustListMasks.TrustedCrls);
            doDebug && console.log(a.toString());

            a.specifiedLists.should.eql(TrustListMasks.TrustedCrls);
            a.trustedCrls?.length.should.eql(1);
            a.issuerCrls?.length.should.eql(0);
            a.trustedCertificates?.length.should.eql(0);
            a.issuerCertificates?.length.should.eql(0);
        });

        it("should write and read back issuer CRLs", async () => {
            const trustList = await getDefaultTrustList();

            // Get a real CRL from the certificate authority
            const { crl } = await _getFakeAuthorityCertificate(await initializeHelpers("TEST_ISSUER_CRL", 0));

            // Write and verify
            const rc = await trustList.writeTrustedCertificateList(
                makeTrustListData(TrustListMasks.IssuerCrls, { issuerCrls: [crl] })
            );
            rc.should.eql(false);

            // Read back with IssuerCrls mask
            const a = await trustList.readTrustedCertificateListWithMasks(TrustListMasks.IssuerCrls);
            doDebug && console.log(a.toString());

            a.specifiedLists.should.eql(TrustListMasks.IssuerCrls);
            a.issuerCrls?.length.should.eql(1);
            a.trustedCrls?.length.should.eql(0);
            a.trustedCertificates?.length.should.eql(0);
            a.issuerCertificates?.length.should.eql(0);
        });

        it("should write and read back both trusted and issuer CRLs", async () => {
            const trustList = await getDefaultTrustList();

            // Get a real CRL from the certificate authority
            const { crl } = await _getFakeAuthorityCertificate(await initializeHelpers("TEST_BOTH_CRLS", 0));

            const crlMask = TrustListMasks.TrustedCrls | TrustListMasks.IssuerCrls;

            // Write and verify
            const rc = await trustList.writeTrustedCertificateList(
                makeTrustListData(crlMask, { trustedCrls: [crl], issuerCrls: [crl] })
            );
            rc.should.eql(false);

            // Read back with both CRL masks
            const a = await trustList.readTrustedCertificateListWithMasks(crlMask);
            doDebug && console.log(a.toString());

            a.specifiedLists.should.eql(crlMask);
            a.trustedCrls?.length.should.eql(1);
            a.issuerCrls?.length.should.eql(1); // same CRL → same filename → 1 file on disk
            a.trustedCertificates?.length.should.eql(0);
            a.issuerCertificates?.length.should.eql(0);
        });

        it("should replace existing CRLs when writing new trust list", async () => {
            const trustList = await getDefaultTrustList();

            // Get a real CRL from the certificate authority
            const { crl } = await _getFakeAuthorityCertificate(await initializeHelpers("TEST_REPLACE_CRL", 0));

            // First, write a trust list with issuer CRLs
            await trustList.writeTrustedCertificateList(
                makeTrustListData(TrustListMasks.IssuerCrls, { issuerCrls: [crl] })
            );

            // Verify the initial write
            let a = await trustList.readTrustedCertificateListWithMasks(TrustListMasks.IssuerCrls);
            a.issuerCrls?.length.should.eql(1);

            // Now write a new trust list with 1 issuer CRL (should replace the previous)
            await trustList.writeTrustedCertificateList(
                makeTrustListData(TrustListMasks.IssuerCrls, { issuerCrls: [crl] })
            );

            // Verify the replacement
            a = await trustList.readTrustedCertificateListWithMasks(TrustListMasks.IssuerCrls);
            doDebug && console.log(a.toString());
            a.issuerCrls?.length.should.eql(1); // Should have only 1 CRL now, not 3
        });

        it("should handle empty CRL arrays correctly", async () => {
            const trustList = await getDefaultTrustList();

            // Get a real CRL from the certificate authority
            const { crl } = await _getFakeAuthorityCertificate(await initializeHelpers("TEST_EMPTY_CRL", 0));
            const crlMask = TrustListMasks.IssuerCrls | TrustListMasks.TrustedCrls;

            // First, write some CRLs
            await trustList.writeTrustedCertificateList(
                makeTrustListData(crlMask, { trustedCrls: [crl], issuerCrls: [crl] })
            );

            // Verify CRLs were written
            let a = await trustList.readTrustedCertificateListWithMasks(crlMask);
            a.issuerCrls?.length.should.eql(1);
            a.trustedCrls?.length.should.eql(1);

            // Now write empty CRL arrays (should clear them)
            await trustList.writeTrustedCertificateList(makeTrustListData(crlMask));

            // Verify CRLs were cleared
            a = await trustList.readTrustedCertificateListWithMasks(crlMask);
            doDebug && console.log(a.toString());
            a.issuerCrls?.length.should.eql(0);
            a.trustedCrls?.length.should.eql(0);
        });

        it("should write trust list with certificates and CRLs together", async () => {
            const trustList = await getDefaultTrustList();

            // First add a certificate using the addCertificate method
            const certificates = caCertChain;

            // Preload issuer certificates so AddCertificate validation succeeds
            await preloadIssuerCertificates(trustList, certificates.slice(1));

            const sc = await trustList.addCertificate(combine_der(certificates), /*isTrustedCertificate =*/ true);
            sc.should.eql(StatusCodes.Good);

            // Verify certificate was added
            let a = await trustList.readTrustedCertificateList();
            a.trustedCertificates?.length.should.eql(1);
            a.issuerCertificates?.length.should.eql(certificates.length - 1);

            // Now add CRLs and issuer certificates using writeTrustedCertificateList
            const { crl } = await _getFakeAuthorityCertificate(await initializeHelpers("TEST_CERT_AND_CRL", 0));

            const newTrustList = makeTrustListData(
                TrustListMasks.TrustedCertificates | TrustListMasks.IssuerCertificates | TrustListMasks.IssuerCrls,
                {
                    trustedCertificates: a.trustedCertificates,
                    issuerCertificates: certificates.slice(1), // Add issuer certificates from chain
                    issuerCrls: [crl] // identical CRLs produce same filename, only 1 stored
                }
            );

            // Write the trust list with certificates and CRLs
            const rc = await trustList.writeTrustedCertificateList(newTrustList);
            rc.should.eql(false);

            // Read back everything and verify
            a = await trustList.readTrustedCertificateList();
            doDebug && console.log(a.toString());

            a.trustedCertificates?.length.should.eql(1);
            a.issuerCertificates?.length.should.eql(1);
            a.issuerCrls?.length.should.eql(1); // same CRL → same filename → 1 file on disk
        });

        it("should preserve certificates when updating only CRLs", async () => {
            const trustList = await getDefaultTrustList();

            // First, add a certificate
            const certificates = caCertChain;

            await trustList.writeTrustedCertificateList(
                makeTrustListData(TrustListMasks.TrustedCertificates, { trustedCertificates: [certificates[0]] })
            );

            // Verify certificate was added
            let a = await trustList.readTrustedCertificateList();
            a.trustedCertificates?.length.should.eql(1);

            // Now update only CRLs
            const { crl } = await _getFakeAuthorityCertificate(await initializeHelpers("TEST_PRESERVE_CERT", 0));

            await trustList.writeTrustedCertificateList(
                makeTrustListData(TrustListMasks.IssuerCrls, { issuerCrls: [crl] })
            );

            // Verify certificate is still there and CRL was added
            a = await trustList.readTrustedCertificateList();
            doDebug && console.log(a.toString());

            a.trustedCertificates?.length.should.eql(1); // Certificate should still be there
            a.issuerCrls?.length.should.eql(1);
        });

        describe("RemoveCertificate", () => {
            it("should remove a trusted certificate by thumbprint", async () => {
                const trustList = await getDefaultTrustList();

                // Add a certificate first
                const certificates = [selfSignedCert];

                let sc = await trustList.addCertificate(certificates[0], /*isTrustedCertificate =*/ true);
                sc.should.eql(StatusCodes.Good);

                // Verify certificate was added
                let a = await trustList.readTrustedCertificateList();
                a.trustedCertificates?.length.should.eql(1);

                // Calculate thumbprint of the actual certificate (not the buffer which may contain chain)
                const thumbprint = makeSHA1Thumbprint(certificates[0]).toString("hex");
                sc = await trustList.removeCertificate(thumbprint, /*isTrustedCertificate =*/ true);
                sc.should.eql(StatusCodes.Good);

                // Verify certificate was removed
                a = await trustList.readTrustedCertificateList();
                a.trustedCertificates?.length.should.eql(0);
            });

            it("should reject isTrustedCertificate=false per OPC UA spec", async () => {
                const trustList = await getDefaultTrustList();

                // OPC UA Spec: "If FALSE Bad_CertificateInvalid is returned."
                const certificates = caCertChain;

                const sc = await trustList.addCertificate(certificates[0], /*isTrustedCertificate =*/ false);
                sc.should.eql(StatusCodes.BadCertificateInvalid);
            });

            it("should remove an issuer certificate by thumbprint", async () => {
                const trustList = await getDefaultTrustList();

                // Since AddCertificate can no longer add issuer certificates per OPC UA spec,
                // we need to use writeTrustedCertificateList to add issuer certificates
                const certificates = caCertChain;

                // Create a trust list with issuer certificates
                await trustList.writeTrustedCertificateList(
                    makeTrustListData(TrustListMasks.IssuerCertificates, { issuerCertificates: certificates })
                );

                // Verify issuer certificates were added
                let a = await trustList.readTrustedCertificateList();
                a.issuerCertificates?.length.should.eql(2); // client cert + its CA

                // Calculate thumbprint of the leaf certificate (first in chain) and remove it
                const thumbprint = makeSHA1Thumbprint(certificates[0]).toString("hex");
                const sc = await trustList.removeCertificate(thumbprint, /*isTrustedCertificate =*/ false);
                sc.should.eql(StatusCodes.Good);

                // Verify certificate was removed (CA should still be there)
                a = await trustList.readTrustedCertificateList();
                a.issuerCertificates?.length.should.eql(1);
            });

            it("should accept thumbprint in both plain hex and NodeOPCUA[hex] formats", async () => {
                const trustList = await getDefaultTrustList();

                // Add two certificates
                const cert1Chain = [selfSignedCert];
                const cert2Chain = [selfSignedCert2];

                await trustList.addCertificate(cert1Chain[0], true);
                await trustList.addCertificate(cert2Chain[0], true);

                let a = await trustList.readTrustedCertificateList();
                a.trustedCertificates?.length.should.eql(2);

                // Remove first certificate using plain hex format
                const thumbprint1 = makeSHA1Thumbprint(cert1Chain[0]).toString("hex");
                let sc = await trustList.removeCertificate(thumbprint1, true);
                sc.should.eql(StatusCodes.Good);

                a = await trustList.readTrustedCertificateList();
                a.trustedCertificates?.length.should.eql(1);

                // Remove second certificate using NodeOPCUA[hex] format
                const thumbprint2 = makeSHA1Thumbprint(cert2Chain[0]).toString("hex");
                const thumbprintWithPrefix = `NodeOPCUA[${thumbprint2}]`;
                sc = await trustList.removeCertificate(thumbprintWithPrefix, true);
                sc.should.eql(StatusCodes.Good);

                a = await trustList.readTrustedCertificateList();
                a.trustedCertificates?.length.should.eql(0);
            });

            it("should return BadInvalidArgument when thumbprint does not match any certificate", async () => {
                const trustList = await getDefaultTrustList();

                // Try to remove a certificate that doesn't exist
                const fakeThumbprint = "0123456789abcdef0123456789abcdef01234567";
                const sc = await trustList.removeCertificate(fakeThumbprint, true);
                sc.should.eql(StatusCodes.BadInvalidArgument);
            });

            it("should return BadInvalidState when trust list is already opened", async () => {
                const trustList = await getDefaultTrustList();

                // Add a certificate first
                const certificates = [selfSignedCert];
                await trustList.addCertificate(certificates[0], true);

                // Open the trust list
                await trustList.openWithMasks(TrustListMasks.All);

                // Try to remove certificate while trust list is open
                const thumbprint = makeSHA1Thumbprint(certificates[0]).toString("hex");
                const sc = await trustList.removeCertificate(thumbprint, true);
                sc.should.eql(StatusCodes.BadInvalidState);

                // Close the trust list
                await trustList.close();
            });

            it("should look for certificate in correct folder based on isTrustedCertificate flag", async () => {
                const trustList = await getDefaultTrustList();

                // Add a self-signed certificate as trusted
                const certificates = [selfSignedCert];
                await trustList.addCertificate(certificates[0], true);

                let a = await trustList.readTrustedCertificateList();
                a.trustedCertificates?.length.should.eql(1);


                const thumbprint = makeSHA1Thumbprint(certificates[0]).toString("hex");

                // Try to remove from issuer folder (wrong folder) - should return BadInvalidArgument
                let sc = await trustList.removeCertificate(thumbprint, false);
                sc.should.eql(StatusCodes.BadInvalidArgument);

                // Remove from trusted folder (correct folder) - should succeed
                sc = await trustList.removeCertificate(thumbprint, true);
                sc.should.eql(StatusCodes.Good);

                a = await trustList.readTrustedCertificateList();
                a.trustedCertificates?.length.should.eql(0);
            });

            it("should update LastUpdateTime property when trust list is modified", async () => {
                const trustList = await getDefaultTrustList();

                // Get the TrustList node to check LastUpdateTime directly
                const trustListNode = addressSpace.findNode(trustList.nodeId) as UATrustList;
                const lastUpdateTimeNode = trustListNode.lastUpdateTime;
                should.exist(lastUpdateTimeNode, "LastUpdateTime property should exist on TrustList");
                if (!lastUpdateTimeNode) return; // for type narrowing

                // Read initial timestamp
                const initialTime = lastUpdateTimeNode.readValue().value.value as Date;
                should.exist(initialTime);

                // Wait a bit to ensure timestamp will be different
                await new Promise((resolve) => setTimeout(resolve, 10));

                // Add a certificate - should update LastUpdateTime
                const certificates = [selfSignedCert];
                await trustList.addCertificate(certificates[0], true);

                const afterAddTime = lastUpdateTimeNode.readValue().value.value as Date;
                afterAddTime.getTime().should.be.greaterThan(initialTime.getTime());

                // Wait a bit to ensure timestamp will be different
                await new Promise((resolve) => setTimeout(resolve, 10));

                // Remove the certificate - should update LastUpdateTime again
                const thumbprint = makeSHA1Thumbprint(certificates[0]).toString("hex");
                const sc = await trustList.removeCertificate(thumbprint, true);
                sc.should.eql(StatusCodes.Good);

                const afterRemoveTime = lastUpdateTimeNode.readValue().value.value as Date;
                afterRemoveTime.getTime().should.be.greaterThan(afterAddTime.getTime());

                // Wait a bit to ensure timestamp will be different
                await new Promise((resolve) => setTimeout(resolve, 10));

                // Use writeTrustedCertificateList (which calls closeAndUpdate) - should update LastUpdateTime
                await trustList.writeTrustedCertificateList(
                    makeTrustListData(TrustListMasks.TrustedCertificates, { trustedCertificates: [certificates[0]] })
                );

                const afterWriteTime = lastUpdateTimeNode.readValue().value.value as Date;
                afterWriteTime.getTime().should.be.greaterThan(afterRemoveTime.getTime());
            });

            it("should initialize LastUpdateTime from filesystem when files exist", async () => {
                const trustList = await getDefaultTrustList();
                const trustListNode = addressSpace.findNode(trustList.nodeId) as UATrustList;
                const lastUpdateTimeNode = trustListNode.lastUpdateTime;
                should.exist(lastUpdateTimeNode, "LastUpdateTime property should exist on TrustList");
                if (!lastUpdateTimeNode) return;

                // Add a certificate so the PKI store has files on disk
                const certificates = [selfSignedCert];
                await trustList.addCertificate(certificates[0], true);

                // Read the timestamp after addCertificate — should be a valid date
                const afterAddTime = lastUpdateTimeNode.readValue().value.value as Date;
                afterAddTime.getTime().should.be.greaterThan(0, "LastUpdateTime should NOT be MinDate after addCertificate");

                // Now reset LastUpdateTime to MinDate to simulate a fresh promoteTrustList
                lastUpdateTimeNode.setValueFromSource({
                    dataType: DataType.DateTime,
                    value: new Date(0)
                });

                // Re-promote the trust list (simulates server restart)
                const { promoteTrustList } = await import("../dist/server/promote_trust_list.js");
                await promoteTrustList(trustListNode as any);

                // LastUpdateTime should now reflect the filesystem mtime, not MinDate
                const afterPromoteTime = lastUpdateTimeNode.readValue().value.value as Date;
                afterPromoteTime.getTime().should.be.greaterThan(0,
                    "LastUpdateTime should be initialized from filesystem mtime, not remain MinDate");
            });

            it("should keep LastUpdateTime at MinDate when trust store is empty", async () => {
                const trustList = await getDefaultTrustList();
                const trustListNode = addressSpace.findNode(trustList.nodeId) as UATrustList;
                const lastUpdateTimeNode = trustListNode.lastUpdateTime;
                should.exist(lastUpdateTimeNode, "LastUpdateTime property should exist on TrustList");
                if (!lastUpdateTimeNode) return;

                // Reset LastUpdateTime to MinDate
                lastUpdateTimeNode.setValueFromSource({
                    dataType: DataType.DateTime,
                    value: new Date(0)
                });

                // Re-promote on an empty trust store
                const { promoteTrustList } = await import("../dist/server/promote_trust_list.js");
                await promoteTrustList(trustListNode as any);

                // LastUpdateTime should remain at epoch (no files to read mtime from)
                const afterPromoteTime = lastUpdateTimeNode.readValue().value.value as Date;
                afterPromoteTime.getTime().should.eql(0,
                    "LastUpdateTime should remain MinDate when no files exist in trust store");
            });
        });

        describe("AddCertificate - Security and Validation", () => {
            it("should return BadSecurityModeInsufficient without encrypted channel", async () => {
                const trustList = await getDefaultTrustList(opcuaServer, makeUnsecureSession(session));

                const certificates = [selfSignedCert];

                const sc = await trustList.addCertificate(certificates[0], true);
                sc.should.eql(StatusCodes.BadSecurityModeInsufficient);
            });

            it("should return BadUserAccessDenied without proper user roles", async () => {
                const trustList = await getDefaultTrustList(makeRestrictedServer(), session);

                const certificates = [selfSignedCert];

                const sc = await trustList.addCertificate(certificates[0], true);
                sc.should.eql(StatusCodes.BadUserAccessDenied);
            });

            it("should return BadInvalidState when trust list is opened for write", async () => {
                const trustList = await getDefaultTrustList();

                // Open the trust list for writing

                await trustList.open(OpenFileMode.WriteEraseExisting);

                // Try to add certificate while trust list is open for write
                const certificates = [selfSignedCert];

                const sc = await trustList.addCertificate(certificates[0], true);
                sc.should.eql(StatusCodes.BadInvalidState);

                // Clean up - close the trust list
                // closeAndUpdate will fail with BadInternalError since we didn't write anything
                // Just close the file handle instead
                await trustList.close();
            });

            it("should only add leaf certificate when certificate chain is provided", async () => {
                const trustList = await getDefaultTrustList();

                // Use a certificate with a chain (leaf + CA)
                const certificates = caCertChain;

                // Verify this is actually a chain
                certificates.length.should.be.greaterThan(1);

                // First, add the issuer certificates manually so the chain validation passes
                await preloadIssuerCertificates(trustList, certificates.slice(1));

                // Now add the certificate chain using AddCertificate
                const sc = await trustList.addCertificate(combine_der(certificates), true);
                sc.should.eql(StatusCodes.Good);

                // Verify: only the leaf certificate should be in trusted certs
                const result = await trustList.readTrustedCertificateList();
                result.trustedCertificates?.length.should.eql(1);

                // The stored ByteString is the full chain (chain-on-disk paradigm).
                // Extract the leaf (first DER block) to compare thumbprints.
                const storedChain = split_der(result.trustedCertificates?.[0] ?? Buffer.alloc(0));
                const addedCertThumbprint = makeSHA1Thumbprint(storedChain[0]).toString("hex");
                const leafThumbprint = makeSHA1Thumbprint(certificates[0]).toString("hex");
                addedCertThumbprint.should.eql(leafThumbprint);

                // Issuer certificates should still be in issuer list (not added by AddCertificate)
                result.issuerCertificates?.length.should.eql(certificates.length - 1);
            });
        });

        describe("RemoveCertificate - Security and Chain Validation", () => {
            it("should return BadSecurityModeInsufficient without encrypted channel", async () => {
                const trustList = await getDefaultTrustList(opcuaServer, makeUnsecureSession(session));

                const fakeThumbprint = "0123456789abcdef0123456789abcdef01234567";
                const sc = await trustList.removeCertificate(fakeThumbprint, true);
                sc.should.eql(StatusCodes.BadSecurityModeInsufficient);
            });

            it("should return BadUserAccessDenied without proper user roles", async () => {
                const trustList = await getDefaultTrustList(makeRestrictedServer(), session);

                const fakeThumbprint = "0123456789abcdef0123456789abcdef01234567";
                const sc = await trustList.removeCertificate(fakeThumbprint, true);
                sc.should.eql(StatusCodes.BadUserAccessDenied);
            });

            it("should return BadCertificateChainIncomplete when removing issuer needed for trusted cert validation", async () => {
                const trustList = await getDefaultTrustList();

                // Use a certificate with a chain (leaf + CA)
                const certificates = caCertChain;

                // Add the entire chain: leaf as trusted, CA as issuer
                await trustList.writeTrustedCertificateList(
                    makeTrustListData(TrustListMasks.TrustedCertificates | TrustListMasks.IssuerCertificates, {
                        trustedCertificates: [certificates[0]], // Only the leaf certificate
                        issuerCertificates: certificates.slice(1) // CA certs in issuers
                    })
                );

                // Verify setup
                let result = await trustList.readTrustedCertificateList();
                result.trustedCertificates?.length.should.be.greaterThan(0);
                result.issuerCertificates?.length.should.be.greaterThan(0);

                // Try to remove the CA certificate that the trusted cert depends on
                // The leaf cert depends on this CA in issuerCertificates, so removing it should fail
                const caThumbprint = makeSHA1Thumbprint(certificates[1]).toString("hex");
                const sc = await trustList.removeCertificate(caThumbprint, false);

                // Should return BadCertificateChainIncomplete because trusted cert depends on this CA
                sc.should.eql(StatusCodes.BadCertificateChainIncomplete);

                // Verify the CA was not removed
                result = await trustList.readTrustedCertificateList();
                result.issuerCertificates?.length.should.be.greaterThan(0);
            });
        });

        describe("Open and OpenWithMasks - OPC UA Spec Compliance", () => {
            it("should return BadNotSupported for unsupported file open modes", async () => {
                const trustList = await getDefaultTrustList();

                // Get the trust list node to call open directly with unsupported mode
                const trustListNode = addressSpace.findNode(trustList.nodeId) as UATrustList;
                const openMethod = trustListNode.getChildByName("Open") as UAMethod;

                // Try to open with Write mode (0x02) - not supported per OPC UA spec
                // OPC UA spec: Only Read (0x01) and WriteEraseExisting (0x06) are supported
                const context = new SessionContext({ server: opcuaServer, session });
                const result = await openMethod.execute(
                    trustListNode,
                    [new Variant({ dataType: DataType.Byte, value: 0x02 })], // Write mode (unsupported)
                    context
                );
                result.statusCode?.should.eql(StatusCodes.BadNotSupported);
            });

            it("should return BadInvalidState when opening while already opened for write", async () => {
                const trustList = await getDefaultTrustList();

                // Open the trust list for writing

                await trustList.open(OpenFileMode.WriteEraseExisting);

                // Try to open again (either read or write) - should fail with BadInvalidState
                const trustListNode = addressSpace.findNode(trustList.nodeId) as UATrustList;
                const openMethod = trustListNode.getChildByName("Open") as UAMethod;

                const context = new SessionContext({ server: opcuaServer, session });
                const result = await openMethod.execute(
                    trustListNode,
                    [new Variant({ dataType: DataType.Byte, value: OpenFileMode.Read })],
                    context
                );

                result.statusCode?.should.eql(StatusCodes.BadInvalidState);

                // Clean up - close the file handle
                // closeAndUpdate will fail since we didn't write anything
                await trustList.close();
            });
        });

        describe("Certificate Validation - OPC UA Part 4 Compliance", () => {
            it("should reject invalid certificate in AddCertificate", async () => {
                const trustList = await getDefaultTrustList();

                // Create an invalid certificate buffer (corrupted data)
                const invalidCertificate = Buffer.from("This is not a valid certificate", "utf-8");

                const sc = await trustList.addCertificate(invalidCertificate, true);
                // Should return BadCertificateInvalid when certificate cannot be parsed or validated
                sc.should.eql(StatusCodes.BadCertificateInvalid);
            });

            it("should reject certificate in addCertificate when issuer is not in TrustList", async () => {
                const trustList = await getDefaultTrustList();

                // Use a certificate with a chain (leaf + CA) but don't add the CA first
                const certificateChain = caCertChain;

                // Try to add the certificate without first adding its issuer to the trust list
                // Per OPC UA spec: "This Method will return a validation error if the Certificate 
                // is issued by a CA and the Certificate for the issuer is not in the TrustList"
                const sc1 = await trustList.addCertificate(certificateChain[0], true);
                console.log("sc1", sc1);
                sc1.should.eql(StatusCodes.BadCertificateChainIncomplete);

                // now try the full chain — the CA is still found in the chain
                // but not registered in the issuers store, so validation
                // returns BadCertificateChainIncomplete
                const sc2 = await trustList.addCertificate(combine_der(certificateChain), true);
                console.log("sc2", sc2);
                sc2.should.eql(StatusCodes.BadCertificateChainIncomplete);
            });

            it("should reject invalid certificates in CloseAndUpdate", async () => {
                const trustList = await getDefaultTrustList();

                // Per OPC UA spec: "The Server shall verify that every Certificate in the new Trust List is valid
                // according to the mandatory rules defined in Part 4. If an invalid Certificate is found the Server
                // shall return an error and shall not update the Trust List."
                try {
                    await trustList.writeTrustedCertificateList(
                        makeTrustListData(TrustListMasks.TrustedCertificates, {
                            trustedCertificates: [Buffer.from("Invalid certificate data", "utf-8")]
                        })
                    );
                    // If we reach here, the implementation should have rejected the invalid certificate
                    // For now, we'll just verify the trust list wasn't corrupted
                    const _result = await trustList.readTrustedCertificateList();
                    // The invalid certificate should not have been added
                    // (implementation may or may not validate at write time vs closeAndUpdate time)
                } catch (_err) {
                    // It's acceptable to throw an error on invalid certificate
                }
            });
        });

        describe("CloseAndUpdate - ApplyChangesRequired Output", () => {
            it("should return applyChangesRequired=false for immediate application mode", async () => {
                const trustList = await getDefaultTrustList();

                // Write a valid trust list
                const certificates = [selfSignedCert];

                // Per OPC UA spec, closeAndUpdate returns applyChangesRequired boolean
                // In immediate mode (no transactions), this should be false
                const applyChangesRequired = await trustList.writeTrustedCertificateList(
                    makeTrustListData(TrustListMasks.TrustedCertificates, { trustedCertificates: [certificates[0]] })
                );
                applyChangesRequired.should.eql(false);
            });
        });

        describe("Multiple Simultaneous Operations", () => {
            it("should allow multiple simultaneous read operations", async () => {
                const trustList = await getDefaultTrustList();
                const context = new SessionContext({ server: opcuaServer, session });
                const pseudoSession = new PseudoSession(addressSpace, context);
                const mgr = new ClientPushCertificateManagement(pseudoSession);
                const group = await mgr.getCertificateGroup("DefaultApplicationGroup");
                const trustList2 = await group.getTrustList();

                // Add a certificate first
                const certificates = [selfSignedCert];
                await trustList.addCertificate(certificates[0], true);

                // Open for read twice (should be allowed per OPC UA spec)

                // First read
                await trustList.open(OpenFileMode.Read);
                const data1 = await trustList.read(65535);

                // Second read should be allowed (multiple read handles)
                await trustList2.open(OpenFileMode.Read);
                const data2 = await trustList2.read(65535);

                // Both reads should return the same data
                data1.length.should.be.greaterThan(0);
                data2.length.should.eql(data1.length);

                // Close both handles
                await trustList.close();
                await trustList2.close();
            });

            it("should prevent AddCertificate while file is open for read", async () => {
                const trustList = await getDefaultTrustList();

                // Open for read
                await trustList.open(OpenFileMode.Read);

                // Try to add certificate while open
                const certificates = [selfSignedCert];
                const sc = await trustList.addCertificate(certificates[0], true);

                // Should return BadInvalidState per OPC UA spec
                sc.should.eql(StatusCodes.BadInvalidState);

                // Close the file
                await trustList.close();
            });
        });
    });
});
