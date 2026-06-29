/**
 * Browse / channel hardening for the security-sensitive RoleSet & User
 * Management nodes (OPC 10000-18 §4.4.1), proven through the *existing* address
 * space mechanisms (RolePermissions + AccessRestrictions):
 *
 *  - a non-admin's Browse of a Role does not reveal its `Identities` Property or
 *    its configuration Methods (they carry SecurityAdmin-only RolePermissions);
 *  - reading `Identities` is denied to a non-admin (Bad_UserAccessDenied) and to
 *    *anyone* over an unencrypted channel (Bad_SecurityModeInsufficient);
 *  - the Role node itself stays browsable, so the RoleSet hierarchy is intact.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import "should";
import { AddressSpace, type IServerBase, PseudoSession, type UARole } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { AttributeIds, BrowseDirection } from "node-opcua-data-model";
import { type NodeId, resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { InMemoryIdentityMappingStore, WellKnownRoleIds } from "node-opcua-role-set-common";
import {
    type IServerForRoleSet,
    type IServerForUserManagement,
    installRoleSet,
    installUserManagement
} from "node-opcua-role-set-server";
import { StatusCodes } from "node-opcua-status-code";
import {
    AnonymousIdentityToken,
    IdentityCriteriaType,
    IdentityMappingRuleType,
    MessageSecurityMode,
    type UserIdentityToken,
    UserNameIdentityToken
} from "node-opcua-types";
import { bootstrapArchive, makeSessionContext } from "./helpers.js";

type TestServer = IServerForRoleSet & IServerForUserManagement & IServerBase;
const { SignAndEncrypt, None } = MessageSecurityMode;

describe("Browse / channel hardening of RoleSet & UserManagement (§4.4.1)", function () {
    this.timeout(30000);

    const tmpDir = path.join(__dirname, "..", "_tmp_hardening");
    const persistencePath = path.join(tmpDir, "roles.bin");
    const securityAdminRole = WellKnownRoleIds.SecurityAdmin;
    const roleSetNodeId = resolveNodeId("ns=0;i=15606"); // Server_ServerCapabilities_RoleSet
    const userManagementNodeId = resolveNodeId("ns=0;i=24290"); // UserManagement Object

    let addressSpace: AddressSpace;
    let server: TestServer;

    const session = (token: UserIdentityToken, securityMode = SignAndEncrypt) =>
        new PseudoSession(addressSpace, makeSessionContext(server, token, securityMode));
    const adminSession = (securityMode = SignAndEncrypt) => session(new UserNameIdentityToken({ userName: "admin" }), securityMode);
    const anonSession = (securityMode = SignAndEncrypt) => session(new AnonymousIdentityToken(), securityMode);

    /** The BrowseNames of a node's forward children, as seen by `s`. */
    async function childNames(s: PseudoSession, nodeId: NodeId): Promise<string[]> {
        const r = await s.browse({ nodeId, browseDirection: BrowseDirection.Forward, resultMask: 0xff });
        return (r.references ?? []).map((ref) => ref.browseName.name ?? "");
    }

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("http://hardening-test");
        await generateAddressSpace(addressSpace, [nodesets.standard]);

        const bootstrap = new InMemoryIdentityMappingStore();
        bootstrap.addIdentity(
            securityAdminRole,
            new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.UserName, criteria: "admin" })
        );
        await bootstrapArchive(persistencePath, bootstrap);

        server = {
            roleResolvers: [],
            engine: { addressSpace },
            userManager: { getUserRoles: () => [] }
        } as unknown as TestServer;

        await installRoleSet(server, { persistencePath });
        await installUserManagement(server);
    });

    after(async () => {
        addressSpace.dispose();
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    });

    it("admin Browse of a Role reveals Identities + the config Methods", async () => {
        const names = await childNames(adminSession(), securityAdminRole);
        names.should.containEql("Identities");
        names.should.containEql("AddIdentity");
        names.should.containEql("RemoveIdentity");
    });

    it("non-admin Browse of a Role hides Identities + the config Methods (but not the Role itself)", async () => {
        // the Role node is reachable (we just browsed it); its sensitive children are not
        const names = await childNames(anonSession(), securityAdminRole);
        names.should.not.containEql("Identities");
        names.should.not.containEql("AddIdentity");
        names.should.not.containEql("RemoveIdentity");
    });

    it("non-admin Browse of the RoleSet hides AddRole/RemoveRole", async () => {
        const names = await childNames(anonSession(), roleSetNodeId);
        names.should.not.containEql("AddRole");
        names.should.not.containEql("RemoveRole");
        // an admin still sees them
        (await childNames(adminSession(), roleSetNodeId)).should.containEql("AddRole");
    });

    describe("reading the Identities Property", () => {
        let identitiesNodeId: NodeId;

        before(() => {
            const roleNode = addressSpace.findNode(securityAdminRole) as UARole | null;
            if (!roleNode) throw new Error("SecurityAdmin Role node not found");
            identitiesNodeId = roleNode.identities.nodeId;
        });

        const readIdentities = (s: PseudoSession) =>
            s.read({ nodeId: identitiesNodeId, attributeId: AttributeIds.Value }).then((dv) => dv.statusCode);

        it("admin over an encrypted channel may read it", async () => {
            (await readIdentities(adminSession(SignAndEncrypt))).should.equal(StatusCodes.Good);
        });

        it("admin over an UNencrypted channel is denied (Bad_SecurityModeInsufficient)", async () => {
            (await readIdentities(adminSession(None))).should.equal(StatusCodes.BadSecurityModeInsufficient);
        });

        it("a non-admin (even encrypted) is denied (Bad_UserAccessDenied)", async () => {
            (await readIdentities(anonSession(SignAndEncrypt))).should.equal(StatusCodes.BadUserAccessDenied);
        });
    });

    it("non-admin Browse of UserManagement hides AddUser/ModifyUser/RemoveUser but keeps ChangePassword", async () => {
        const names = await childNames(anonSession(), userManagementNodeId);
        names.should.not.containEql("AddUser");
        names.should.not.containEql("ModifyUser");
        names.should.not.containEql("RemoveUser");
        // ChangePassword stays callable by authenticated users → still browsable
        names.should.containEql("ChangePassword");
    });
});
