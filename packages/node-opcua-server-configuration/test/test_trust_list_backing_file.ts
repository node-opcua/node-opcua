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
import { MessageSecurityMode, UserNameIdentityToken } from "node-opcua-types";
import { ClientPushCertificateManagement, installPushCertificateManagement } from "../dist/index.js";
import { initializeHelpers } from "./helpers/fake_certificate_authority.js";

/**
 * installPushCertificateManagement promotes every CertificateGroup it finds
 * under ServerConfiguration, but binds a certificateManager only to
 * DefaultApplicationGroup and DefaultUserTokenGroup, and to the latter only
 * when one was supplied. A group can therefore end up promoted with nothing
 * to serve.
 *
 * promoteTrustList used to point such a group's FileType at a path on the
 * shared memfs volume without creating it: the file was written by the Open
 * wrapper, which for an unbound group falls straight through to the raw
 * implementation. Open then failed with
 *
 *   ENOENT: no such file or directory, open '/tmpFile3'
 *
 * and the client got Bad_UnexpectedError. An empty TrustList is the correct
 * answer for a group that has nothing to serve.
 */
describe("TrustList backing file", () => {
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

    before(async () => {
        const _folder = await initializeHelpers("BACKINGFILE", 0);

        applicationGroup = new CertificateManager({
            location: path.join(_folder, "application")
        });
        await applicationGroup.initialize();

        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        addressSpace.registerNamespace("Private");
    });

    after(async () => {
        session.continuationPointManager?.dispose();
        await addressSpace.shutdown();
        addressSpace.dispose();
        await applicationGroup.dispose();
    });

    it("TLBF-1 should open the TrustList of a group that has no certificateManager", async () => {
        // no userTokenGroup: DefaultUserTokenGroup is promoted but left unbound
        await installPushCertificateManagement(addressSpace, {
            applicationGroup,
            applicationUri: "SomeUri"
        });

        const context = new SessionContext({ server: opcuaServer, session });
        const pseudoSession = new PseudoSession(addressSpace, context);

        const client = new ClientPushCertificateManagement(pseudoSession);
        const group = await client.getCertificateGroup("DefaultUserTokenGroup");
        const trustList = await group.getTrustList();

        // used to raise ENOENT on the memfs path and answer Bad_UnexpectedError
        const fileHandle = await trustList.open(OpenFileMode.Read);
        fileHandle.should.be.a.Number();
        fileHandle.should.be.greaterThan(0);

        await trustList.close();
    });

    it("TLBF-2 should give each TrustList its own backing path", async () => {
        const serverConfiguration = addressSpace.rootFolder.objects.server.getChildByName("ServerConfiguration")!;
        const groups = serverConfiguration.getChildByName("CertificateGroups")!;

        const filenames = groups
            .getComponents()
            .map((g) => (g as unknown as { getComponentByName(n: string): unknown }).getComponentByName("TrustList"))
            .filter((t) => !!t)
            .map((t) => (t as unknown as { $$filename?: string }).$$filename)
            .filter((f): f is string => !!f);

        filenames.length.should.be.greaterThan(1);
        new Set(filenames).size.should.eql(filenames.length);
    });
});
