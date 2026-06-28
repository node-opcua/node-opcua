/**
 * User-management persistence across restart, coordinated with the role set in
 * ONE consolidated archive (OPC 10000-18 §5).
 *
 * A shared `ArchiveStore` is passed to both `installRoleSet` and
 * `installUserManagement`; a "restart" is a fresh AddressSpace + a fresh
 * ArchiveStore pointing at the same file. Users (salted scrypt hashes, never the
 * clear password) must survive the restart and the password must still verify.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { AddressSpace, type IServerBase } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { nodesets } from "node-opcua-nodesets";
import { ClientUserManagement } from "node-opcua-role-set-client";
import {
    ArchiveStore,
    InMemoryIdentityMappingStore,
    type IUserManagementStore,
    WellKnownRoleIds
} from "node-opcua-role-set-common";
import {
    type IServerForRoleSet,
    type IServerForUserManagement,
    installRoleSet,
    installUserManagement
} from "node-opcua-role-set-server";
import { StatusCodes } from "node-opcua-status-code";
import { IdentityCriteriaType, IdentityMappingRuleType, UserConfigurationMask } from "node-opcua-types";
import "should";
import { bootstrapArchive, userSession } from "./helpers.js";

type TestServer = IServerForRoleSet & IServerForUserManagement & IServerBase;

describe("User Management persistence across restart (shared archive, §5)", function () {
    this.timeout(30000);

    const tmpDir = path.join(__dirname, "..", "_tmp_user_restart");
    const persistencePath = path.join(tmpDir, "role-set.json");
    const secret: string | undefined = undefined; // plaintext archive for this case

    /** Stand up a server sharing ONE ArchiveStore between role set and user management. */
    async function boot(): Promise<{ addressSpace: AddressSpace; server: TestServer; userStore: IUserManagementStore }> {
        const addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("http://user-restart-test");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        const server = {
            roleResolvers: [],
            engine: { addressSpace },
            userManager: { getUserRoles: () => [] }
        } as TestServer;

        const persistence = new ArchiveStore(persistencePath, { secret });
        // role set FIRST, then user management (both share the coordinator)
        await installRoleSet(server, { persistence });
        const { store: userStore } = await installUserManagement(server, { persistence });
        return { addressSpace, server, userStore };
    }

    before(async () => {
        // bootstrap admin -> SecurityAdmin so the admin session can call AddUser
        const bootstrap = new InMemoryIdentityMappingStore();
        bootstrap.addIdentity(
            WellKnownRoleIds.SecurityAdmin,
            new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.UserName, criteria: "admin" })
        );
        await bootstrapArchive(persistencePath, bootstrap, secret);
    });

    after(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch((err: Error) => {
            console.warn(`could not remove temp dir ${tmpDir}: ${err.message}`);
        });
    });

    it("a user added via the client survives a restart (salted hash; password still verifies)", async () => {
        // --- boot #1: admin adds a user through the client ---
        const b1 = await boot();
        const admin1 = new ClientUserManagement(userSession(b1.addressSpace, b1.server, "admin"));
        (await admin1.addUser("alice", "Sekret123!", UserConfigurationMask.None, "Field tech")).statusCode.should.equal(
            StatusCodes.Good
        );
        b1.addressSpace.dispose();

        // the on-disk archive holds alice's record but NOT the clear password
        const onDisk = await fs.readFile(persistencePath, "utf8");
        onDisk.should.containEql("alice");
        onDisk.should.not.containEql("Sekret123!");

        // --- boot #2: restart against the same archive ---
        const b2 = await boot();
        const admin2 = new ClientUserManagement(userSession(b2.addressSpace, b2.server, "admin"));

        // the user reappears in the Users Property (read through the client) ...
        (await admin2.readUsers()).map((u) => u.userName).should.containEql("alice");

        // ... and the salted scrypt hash survived, so the password still verifies
        b2.userStore.authenticate("alice", "Sekret123!").statusCode.should.equal(StatusCodes.Good);
        b2.userStore.authenticate("alice", "wrong-password").statusCode.should.equal(StatusCodes.BadUserAccessDenied);

        b2.addressSpace.dispose();
    });
});
