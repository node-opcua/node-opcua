/**
 * OPC 10000-18 §4.4.3: the Application and TrustedApplication identity
 * criteria, end to end through `installRoleSet` and a SessionContext.
 *
 * The rule is about the client application, not the user: "the criteria is the
 * ApplicationUri from the Client Certificate used for the Session. The Client
 * Certificate shall be trusted by the Server and the Session shall use at
 * least a signed communication channel." The SessionContext reads that URI
 * from the channel's client certificate and hands it, with the security mode,
 * to the registered role resolvers; these tests check the role it yields.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { AddressSpace, type IServerBase } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS.js";
import { makeMockSessionContext } from "node-opcua-address-space/testHelpers.js";
import { CertificatePurpose, convertPEMtoDER, createSelfSignedCertificate, generateKeyPair } from "node-opcua-crypto";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { type NodeId, sameNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { type IIdentityMappingStore, WellKnownRoleIds } from "node-opcua-role-set-common";
import { type IServerForRoleSet, installRoleSet } from "node-opcua-role-set-server";
import { AnonymousIdentityToken, IdentityCriteriaType, IdentityMappingRuleType, MessageSecurityMode } from "node-opcua-types";
import should from "should";
import { scratch } from "./paths.js";

type TestServer = IServerForRoleSet & IServerBase;

const CONSOLE_URI = "urn:example:console";

async function applicationCertificate(applicationUri: string): Promise<Buffer> {
    const { privateKey } = await generateKeyPair(2048);
    const { cert } = await createSelfSignedCertificate({
        privateKey,
        subject: "CN=Some Client/O=Example",
        applicationUri,
        purpose: CertificatePurpose.ForApplication,
        validity: 30
    });
    return convertPEMtoDER(cert);
}

describe("RoleSet Integration: Application and TrustedApplication criteria (§4.4.3)", function (this: Mocha.Suite) {
    this.timeout(30000);

    const tmpDir = scratch("_tmp_application_criteria");
    let addressSpace: AddressSpace;
    let server: TestServer;
    let store: IIdentityMappingStore;
    let consoleCertificate: Buffer;
    let otherCertificate: Buffer;

    const rolesOf = (clientCertificate: Buffer | null, securityMode: MessageSecurityMode): NodeId[] =>
        makeMockSessionContext({
            server,
            userIdentityToken: new AnonymousIdentityToken(),
            securityMode,
            clientCertificate
        }).getCurrentUserRoles();
    const has = (roles: NodeId[], role: NodeId) => roles.some((r) => sameNodeId(r, role));

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("http://application-criteria-test");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        server = {
            roleResolvers: [],
            engine: { addressSpace },
            userManager: { getUserRoles: () => [] }
        } as TestServer;
        store = (await installRoleSet(server, { persistencePath: path.join(tmpDir, "roles.bin") })).store;
        consoleCertificate = await applicationCertificate(CONSOLE_URI);
        otherCertificate = await applicationCertificate("urn:example:other");
    });

    after(async () => {
        addressSpace.dispose();
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    });

    it("grants a role via Application (ApplicationUri) criteria", () => {
        store.addIdentity(
            WellKnownRoleIds.SecurityAdmin,
            new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.Application, criteria: CONSOLE_URI })
        );
        try {
            should(has(rolesOf(consoleCertificate, MessageSecurityMode.SignAndEncrypt), WellKnownRoleIds.SecurityAdmin)).eql(true);
            should(has(rolesOf(consoleCertificate, MessageSecurityMode.Sign), WellKnownRoleIds.SecurityAdmin)).eql(true);
            // Another application, an unsigned channel, no client certificate: nothing.
            should(has(rolesOf(otherCertificate, MessageSecurityMode.SignAndEncrypt), WellKnownRoleIds.SecurityAdmin)).eql(false);
            should(has(rolesOf(consoleCertificate, MessageSecurityMode.None), WellKnownRoleIds.SecurityAdmin)).eql(false);
            should(has(rolesOf(null, MessageSecurityMode.SignAndEncrypt), WellKnownRoleIds.SecurityAdmin)).eql(false);
        } finally {
            store.removeIdentity(
                WellKnownRoleIds.SecurityAdmin,
                new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.Application, criteria: CONSOLE_URI })
            );
        }
    });

    it("does not grant an Application role on a certificate admitted only by a relaxation (NoConfiguration)", () => {
        const rule = new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.Application, criteria: CONSOLE_URI });
        store.addIdentity(WellKnownRoleIds.SecurityAdmin, rule);
        try {
            const relaxed = makeMockSessionContext({
                server,
                userIdentityToken: new AnonymousIdentityToken(),
                channel: {
                    clientCertificate: consoleCertificate,
                    clientCertificateTrustRelaxed: true,
                    securityMode: MessageSecurityMode.SignAndEncrypt,
                    securityPolicy: "",
                    getTransportSettings: () => ({ maxMessageSize: 0 })
                }
            }).getCurrentUserRoles();
            should(has(relaxed, WellKnownRoleIds.SecurityAdmin)).eql(false);
        } finally {
            store.removeIdentity(WellKnownRoleIds.SecurityAdmin, rule);
        }
    });

    it("grants a role via TrustedApplication criteria over a signed channel", () => {
        const rule = new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.TrustedApplication, criteria: "" });
        store.addIdentity(WellKnownRoleIds.Operator, rule);
        try {
            should(has(rolesOf(otherCertificate, MessageSecurityMode.Sign), WellKnownRoleIds.Operator)).eql(true);
            should(has(rolesOf(otherCertificate, MessageSecurityMode.None), WellKnownRoleIds.Operator)).eql(false);
            should(has(rolesOf(null, MessageSecurityMode.SignAndEncrypt), WellKnownRoleIds.Operator)).eql(false);
        } finally {
            store.removeIdentity(WellKnownRoleIds.Operator, rule);
        }
    });
});
