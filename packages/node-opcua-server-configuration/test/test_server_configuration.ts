import * as path from "path";
import * as fs from "fs";

import { AddressSpace, IServerBase, ISessionBase, PseudoSession, SessionContext, WellKnownRoles, makeRoles } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { NodeClass } from "node-opcua-data-model";
import { nodesets } from "node-opcua-nodesets";
import { assert } from "node-opcua-assert";
import { CertificateManager, OPCUACertificateManager } from "node-opcua-certificate-manager";
import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { UserNameIdentityToken } from "node-opcua-types";
import { readCertificate } from "node-opcua-crypto";

import { ClientPushCertificateManagement, installPushCertificateManagement } from "..";
import { initializeHelpers } from "./helpers/fake_certificate_authority";

// make sure extra error checking is made on object constructions
// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("ServerConfiguration", () => {
    let addressSpace: AddressSpace;

    const opcuaServer: IServerBase = {
        userManager: {
            getUserRoles(userName: string): NodeId[] {
                return makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.SecurityAdmin]);
            }
        }
    };
    const session: ISessionBase = {
        userIdentityToken: new UserNameIdentityToken({
            userName: "joedoe"
        }),
        getSessionId() {
            return NodeId.nullNodeId;
        }
    };
    const _tempFolder = path.join(__dirname, "../temp");

    const applicationGroup = new CertificateManager({
        location: path.join(_tempFolder, "application")
    });
    const userTokenGroup = new CertificateManager({
        location: path.join(_tempFolder, "user")
    });

    const xmlFiles = [nodesets.standard];
    before(async () => {
        try {
            await initializeHelpers();

            await applicationGroup.initialize();
            await userTokenGroup.initialize();

            addressSpace = AddressSpace.create();
            await generateAddressSpace(addressSpace, xmlFiles);
            addressSpace.registerNamespace("Private");
        } catch (err) {
            console.log(err);
            throw err;
        }
    });
    after(() => {
        addressSpace.dispose();
    });

    it("should expose a server configuration object", async () => {
        const server = addressSpace.rootFolder.objects.server;
        server.should.have.ownProperty("serverConfiguration");
    });

    it("should expose a server configuration object - Certificate Management", async () => {
        const server = addressSpace.rootFolder.objects.server;

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
        const server = addressSpace.rootFolder.objects.server;
        server.serverConfiguration.should.have.ownProperty("keyCredentialConfiguration");
    });
    it("should expose a server configuration object - Authorization Management", async () => {
        const server = addressSpace.rootFolder.objects.server;
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
        // OPC Unified Architecture, Part 12 24 Release 1.04
        // CertificateManager that ensure only authorized users can register new Servers and request
        // new Certificates.

        it("should implement createSigningRequest", async () => {
            await installPushCertificateManagement(addressSpace, { applicationGroup, userTokenGroup, applicationUri: "SomeURI" });

            const server = addressSpace.rootFolder.objects.server;
            server.serverConfiguration.createSigningRequest.nodeClass.should.eql(NodeClass.Method);

            const pseudoSession = new PseudoSession(addressSpace, opcuaServer, session);
            const clientPullCertificateManager = new ClientPushCertificateManagement(pseudoSession);

            const certificateGroupId = await clientPullCertificateManager.getCertificateGroupId("DefaultApplicationGroup");
            const certificateTypeId = NodeId.nullNodeId;
            const subjectName = "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server";
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
            await installPushCertificateManagement(addressSpace, { applicationUri: "SomeUri" });

            const pseudoSession = new PseudoSession(addressSpace, opcuaServer, session);
            const clientPushCertificateManager = new ClientPushCertificateManagement(pseudoSession);

            const certificateGroupId = NodeId.nullNodeId;
            const certificateTypeId = NodeId.nullNodeId;
            const certificate = Buffer.from("SomeCertificate");
            const issuerCertificates = [Buffer.from("Issuer1"), Buffer.from("Issuer2")];
            const privateKeyFormat = "PEM";
            const privateKey = Buffer.from("1234");

            const result = await clientPushCertificateManager.updateCertificate(
                certificateGroupId,
                certificateTypeId,
                certificate,
                issuerCertificates
            );

            result.statusCode.should.eql(StatusCodes.BadInvalidArgument);
            //            result.applyChangesRequired!.should.eql(true);
        });


        async function give_a_address_space_with_server_configuration_and_default_application_group() {
            const rootFolder = path.join(__dirname, "../temp/pkipki");
            const certificateManager = new OPCUACertificateManager({
                rootFolder
            });
            await certificateManager.initialize();
            const defaultApplicationGroup = addressSpace.rootFolder.objects.server.serverConfiguration.certificateGroups.defaultApplicationGroup;
            (defaultApplicationGroup.trustList as any).$$certificateManager = certificateManager;

        }
        it("should provide trust list", async () => {

            //------------------
            await installPushCertificateManagement(
                addressSpace, { applicationGroup, userTokenGroup, applicationUri: "SomeUri" });

            const pseudoSession = new PseudoSession(addressSpace, opcuaServer, session);
            const clientPushCertificateManager = new ClientPushCertificateManagement(pseudoSession);

            const defaultApplicationGroup = await clientPushCertificateManager.getCertificateGroup("DefaultApplicationGroup");

            const trustList = await defaultApplicationGroup.getTrustList();
            let a = await trustList.readTrustedCertificateList();
            console.log(a.toString());

            // now add a certificate 
            const certificateFile = path.join(__dirname, "../../node-opcua-samples/certificates/client_cert_2048.pem");
            assert(fs.existsSync(certificateFile));

            const certificate = await readCertificate(certificateFile);
            await trustList.addCertificate(certificate, true);

            a = await trustList.readTrustedCertificateList();
            console.log(a.toString());
            a.trustedCertificates.length.should.eql(1);
            a.issuerCertificates.length.should.eql(0);
            a.issuerCrls.length.should.eql(0);
            a.trustedCrls.length.should.eql(0);
        });
    });
});
