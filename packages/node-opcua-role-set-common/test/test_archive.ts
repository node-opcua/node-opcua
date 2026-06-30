import { promises as fs } from "node:fs";
import path from "node:path";
import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { IdentityCriteriaType, IdentityMappingRuleType, UserConfigurationMask } from "node-opcua-types";
import "should";
import {
    ArchiveStore,
    InMemoryIdentityMappingStore,
    InMemoryUserManagementStore,
    identitiesFromBase64,
    identitiesToBase64,
    ROLE_SET_ARCHIVE_VERSION,
    type RoleSetArchive,
    readArchive,
    writeArchive
} from "../source/index.js";

describe("RoleSet consolidated archive", () => {
    const tmpDir = path.join(__dirname, "..", "_tmp_archive");
    const filePath = path.join(tmpDir, "store.json");

    const sampleArchive: RoleSetArchive = {
        version: ROLE_SET_ARCHIVE_VERSION,
        roles: [{ nodeId: "ns=1;g=AAAAAAAA-1111-2222-3333-444444444444", roleName: "Maintenance" }],
        restrictions: [
            {
                nodeId: "ns=0;i=15704",
                applications: ["urn:acme:scada"],
                applicationsExclude: false,
                endpoints: [],
                endpointsExclude: true
            }
        ]
    };

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    });

    it("round-trips a plain JSON archive", async () => {
        await writeArchive(filePath, sampleArchive);
        const text = await fs.readFile(filePath, "utf8");
        text.should.containEql("Maintenance"); // plain JSON, human-readable
        const back = await readArchive(filePath);
        back?.should.eql(sampleArchive);
    });

    it("returns undefined for a missing file", async () => {
        ((await readArchive(path.join(tmpDir, "does-not-exist.json"))) === undefined).should.be.true();
    });

    it("embeds the identity store as a base64 binary blob and restores it", async () => {
        const store = new InMemoryIdentityMappingStore();
        const roleId = new NodeId(NodeId.NodeIdType.NUMERIC, 15704, 0);
        store.addIdentity(roleId, new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.UserName, criteria: "joe" }));

        await writeArchive(filePath, { version: ROLE_SET_ARCHIVE_VERSION, identities: identitiesToBase64(store) });

        const restored = new InMemoryIdentityMappingStore();
        identitiesFromBase64(restored, (await readArchive(filePath))?.identities);
        restored
            .getIdentitiesForRole(roleId)
            .map((r) => r.criteria)
            .should.eql(["joe"]);
    });

    describe("encryption at rest (operator secret)", () => {
        const secret = "correct horse battery staple";

        it("writes an opaque encrypted envelope and decrypts it with the secret", async () => {
            await writeArchive(filePath, sampleArchive, { secret });

            const onDisk = await fs.readFile(filePath, "utf8");
            onDisk.should.containEql('"encrypted": true');
            onDisk.should.not.containEql("Maintenance"); // payload is not readable in clear
            onDisk.should.not.containEql("urn:acme:scada");

            const back = await readArchive(filePath, { secret });
            back?.should.eql(sampleArchive);
        });

        it("refuses to read an encrypted archive without the secret", async () => {
            await writeArchive(filePath, sampleArchive, { secret });
            await readArchive(filePath).should.be.rejectedWith(/encrypted but no secret/);
        });

        it("fails to decrypt with the wrong secret (tamper-evident GCM)", async () => {
            await writeArchive(filePath, sampleArchive, { secret });
            await readArchive(filePath, { secret: "wrong" }).should.be.rejectedWith(/cannot decrypt/);
        });
    });

    it("rejects an archive written by a newer format version", async () => {
        await writeArchive(filePath, { ...sampleArchive, version: ROLE_SET_ARCHIVE_VERSION + 99 });
        await readArchive(filePath).should.be.rejectedWith(/newer archive format/);
    });

    it("rejects a file that is not a RoleSet archive", async () => {
        await fs.mkdir(tmpDir, { recursive: true });
        await fs.writeFile(filePath, JSON.stringify({ hello: "world" }), "utf8");
        await readArchive(filePath).should.be.rejectedWith(/no version field/);
    });

    describe("ArchiveStore coordinator", () => {
        it("gathers sections from several providers into one file and reloads them", async () => {
            const ids = new InMemoryIdentityMappingStore();
            ids.addIdentity(
                new NodeId(NodeId.NodeIdType.NUMERIC, 15704, 0),
                new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.UserName, criteria: "joe" })
            );
            const users = new InMemoryUserManagementStore();
            users.addUser("alice", "Sekret123!", UserConfigurationMask.None, "");

            const store = new ArchiveStore(filePath);
            store.setIdentitiesProvider(() => identitiesToBase64(ids));
            store.setUsersProvider(() => users.exportUsers());
            await store.save();

            // a fresh coordinator (simulating a restart) reloads BOTH sections
            const back = await new ArchiveStore(filePath).load();
            back?.users?.map((u) => u.userName).should.eql(["alice"]);
            (typeof back?.identities).should.equal("string");

            // the salted scrypt hash round-trips: the password still verifies
            const users2 = new InMemoryUserManagementStore();
            users2.importUsers(back?.users ?? []);
            users2.authenticate("alice", "Sekret123!").statusCode.should.equal(StatusCodes.Good);
        });

        it("preserves a section that has no provider yet (install-order independence)", async () => {
            // seed a file that already has roles on disk (as installRoleSet would write)
            await writeArchive(filePath, {
                version: ROLE_SET_ARCHIVE_VERSION,
                roles: [{ nodeId: "ns=1;g=AAAAAAAA-1111-2222-3333-444444444444", roleName: "Maintenance" }]
            });

            // a coordinator that ONLY knows about users (e.g. user mgmt installed first)
            const users = new InMemoryUserManagementStore();
            users.addUser("carol", "Sekret123!", UserConfigurationMask.None, "");
            const store = new ArchiveStore(filePath);
            await store.load(); // remembers the on-disk roles
            store.setUsersProvider(() => users.exportUsers());
            await store.save(); // writes users WITHOUT a roles provider

            // the roles written by the other installer must NOT be clobbered
            const back = await readArchive(filePath);
            back?.roles?.map((r) => r.roleName).should.eql(["Maintenance"]);
            back?.users?.map((u) => u.userName).should.eql(["carol"]);
        });

        it("persists encrypted when a secret is configured", async () => {
            const users = new InMemoryUserManagementStore();
            users.addUser("bob", "Sekret123!", UserConfigurationMask.None, "");
            const store = new ArchiveStore(filePath, { secret: "k" });
            store.setUsersProvider(() => users.exportUsers());
            await store.save();

            (await fs.readFile(filePath, "utf8")).should.containEql('"encrypted": true');
            (await new ArchiveStore(filePath, { secret: "k" }).load())?.users?.map((u) => u.userName).should.eql(["bob"]);
        });
    });
});
