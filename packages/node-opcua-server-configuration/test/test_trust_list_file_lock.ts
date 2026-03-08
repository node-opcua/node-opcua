import path from "node:path";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import "should";
import "mocha";
import {
    AddressSpace,
    ContinuationPointManager,
    type IServerBase,
    type ISessionBase,
    makeRoles,
    PseudoSession,
    SessionContext,
    WellKnownRoles
} from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS.js";
import { CertificateManager } from "node-opcua-certificate-manager";
import { OpenFileMode } from "node-opcua-file-transfer";
import { NodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { SecurityPolicy } from "node-opcua-secure-channel";
import { MessageSecurityMode, TrustListDataType, UserNameIdentityToken } from "node-opcua-types";
import { ClientPushCertificateManagement, installPushCertificateManagement } from "../dist/index.js";
import { TrustListMasks } from "../dist/server/trust_list_server.js";
import { initializeHelpers } from "./helpers/fake_certificate_authority.js";

describe("TrustList File Lock", () => {
    let addressSpace: AddressSpace;

    const opcuaServer: IServerBase = {
        userManager: {
            getUserRoles(_userName: string) {
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

    let applicationGroup: CertificateManager;
    let userTokenGroup: CertificateManager;

    const xmlFiles = [nodesets.standard];

    before(async () => {
        const _folder = await initializeHelpers("BUGFIX2", 0);

        applicationGroup = new CertificateManager({
            location: path.join(_folder, "application")
        });
        userTokenGroup = new CertificateManager({
            location: path.join(_folder, "user")
        });

        await applicationGroup.initialize();
        await userTokenGroup.initialize();

        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, xmlFiles);
        addressSpace.registerNamespace("Private");
    });

    after(async () => {
        session.continuationPointManager?.dispose();
        await addressSpace.shutdown();
        addressSpace.dispose();
        await applicationGroup.dispose();
        await userTokenGroup.dispose();
    });

    it("should allow reopening the trust list for write after a failed CloseAndUpdate", async () => {
        await installPushCertificateManagement(addressSpace, {
            applicationGroup,
            userTokenGroup,
            applicationUri: "SomeUri"
        });

        const context = new SessionContext({ server: opcuaServer, session });
        const pseudoSession = new PseudoSession(addressSpace, context);

        const clientPushCertificateManager = new ClientPushCertificateManagement(pseudoSession);
        const defaultApplicationGroup = await clientPushCertificateManager.getCertificateGroup("DefaultApplicationGroup");
        const trustList = await defaultApplicationGroup.getTrustList();

        // 1. Prepare a payload that is valid TrustListDataType but contains an invalid certificate
        //    (Buffer that is valid DER sequence but NOT a certificate)
        const invalidCert = Buffer.from([0x30, 0x03, 0x02, 0x01, 0x05]); // INTEGER 5 (Valid DER, but not a cert)

        const newTrustList = new TrustListDataType();
        newTrustList.specifiedLists = TrustListMasks.TrustedCertificates;
        newTrustList.trustedCertificates = [invalidCert];

        const retValue = await trustList.writeTrustedCertificateList(newTrustList);
        retValue.should.eql(false);

        // 2. VERIFICATION: immediately try to open it for write again.
        // If the fix is working, this will NOT return BadInvalidState (it will return Good)
        const sc = await trustList.open(OpenFileMode.WriteEraseExisting);

        sc.should.be.a.Number();
        sc.should.be.greaterThan(0);

        // Clean up
        await trustList.close();
    });
});
