import "should";
import { promises as fs } from "node:fs";
import path from "node:path";
import { BinaryStream } from "node-opcua-binary-stream";
import { sameNodeId } from "node-opcua-nodeid";
import { IdentityCriteriaType, IdentityMappingRuleType } from "node-opcua-types";
import { decodeIdentityStore, encodeIdentityStore, loadFromBinaryFile, saveToBinaryFile } from "../source/binary_persistence.js";
import { InMemoryIdentityMappingStore } from "../source/in_memory_store.js";
import { WellKnownRoleIds } from "../source/well_known_role_ids.js";

const SecurityAdmin = WellKnownRoleIds.SecurityAdmin;
const Observer = WellKnownRoleIds.Observer;

describe("Binary Persistence", () => {
    describe("encodeIdentityStore / decodeIdentityStore", () => {
        it("should round-trip an empty store", () => {
            const store = new InMemoryIdentityMappingStore();
            const stream = new BinaryStream(Buffer.alloc(256));

            encodeIdentityStore(store, stream);

            const loaded = new InMemoryIdentityMappingStore();
            const readStream = new BinaryStream((stream.buffer as Buffer).subarray(0, stream.length));
            decodeIdentityStore(loaded, readStream);

            loaded.getRoleIds().should.have.length(0);
        });

        it("should round-trip a store with identities", () => {
            const store = new InMemoryIdentityMappingStore();
            store.addIdentity(
                SecurityAdmin,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.UserName,
                    criteria: "admin"
                })
            );
            store.addIdentity(
                SecurityAdmin,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.Thumbprint,
                    criteria: "AB12CD34EF5678901234567890ABCDEF12345678"
                })
            );
            store.addIdentity(
                Observer,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.Anonymous,
                    criteria: "*"
                })
            );

            const stream = new BinaryStream(Buffer.alloc(4096));
            encodeIdentityStore(store, stream);

            const loaded = new InMemoryIdentityMappingStore();
            const readStream = new BinaryStream((stream.buffer as Buffer).subarray(0, stream.length));
            decodeIdentityStore(loaded, readStream);

            loaded.getRoleIds().should.have.length(2);

            const adminRules = loaded.getIdentitiesForRole(SecurityAdmin);
            adminRules.should.have.length(2);
            adminRules[0].criteriaType.should.equal(IdentityCriteriaType.UserName);
            adminRules[0].criteria?.should.equal("admin");
            adminRules[1].criteriaType.should.equal(IdentityCriteriaType.Thumbprint);

            const observerRules = loaded.getIdentitiesForRole(Observer);
            observerRules.should.have.length(1);
            observerRules[0].criteriaType.should.equal(IdentityCriteriaType.Anonymous);
        });

        it("should preserve NodeId values through round-trip", () => {
            const store = new InMemoryIdentityMappingStore();
            store.addIdentity(
                SecurityAdmin,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.UserName,
                    criteria: "test"
                })
            );

            const stream = new BinaryStream(Buffer.alloc(1024));
            encodeIdentityStore(store, stream);

            const loaded = new InMemoryIdentityMappingStore();
            const readStream = new BinaryStream((stream.buffer as Buffer).subarray(0, stream.length));
            decodeIdentityStore(loaded, readStream);

            const roleIds = loaded.getRoleIds();
            roleIds.should.have.length(1);
            sameNodeId(roleIds[0], SecurityAdmin).should.be.true();
        });
    });

    describe("saveToBinaryFile / loadFromBinaryFile", () => {
        const tmpDir = path.join(__dirname, "..", "_tmp_test_persistence");
        const filePath = path.join(tmpDir, "test_roles.bin");

        afterEach(async () => {
            await fs.rm(tmpDir, { recursive: true, force: true }).catch((err: Error) => {
                console.warn(`could not remove temp dir ${tmpDir}: ${err.message}`);
            });
        });

        it("should save and load round-trip", async () => {
            const store = new InMemoryIdentityMappingStore();
            store.addIdentity(
                SecurityAdmin,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.UserName,
                    criteria: "admin"
                })
            );
            store.addIdentity(
                Observer,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.Anonymous,
                    criteria: "*"
                })
            );

            await saveToBinaryFile(store, filePath);

            // Verify file exists
            const stat = await fs.stat(filePath);
            stat.size.should.be.greaterThan(0);

            const loaded = new InMemoryIdentityMappingStore();
            await loadFromBinaryFile(loaded, filePath);

            loaded.getRoleIds().should.have.length(2);
            loaded.getIdentitiesForRole(SecurityAdmin).should.have.length(1);
            loaded.getIdentitiesForRole(Observer).should.have.length(1);
        });

        it("should handle missing file gracefully", async () => {
            const loaded = new InMemoryIdentityMappingStore();
            await loadFromBinaryFile(loaded, path.join(tmpDir, "nonexistent.bin"));
            loaded.getRoleIds().should.have.length(0);
        });

        it("should handle empty file gracefully", async () => {
            await fs.mkdir(tmpDir, { recursive: true });
            await fs.writeFile(filePath, Buffer.alloc(0));

            const loaded = new InMemoryIdentityMappingStore();
            await loadFromBinaryFile(loaded, filePath);
            loaded.getRoleIds().should.have.length(0);
        });

        it("should report a corrupt / truncated file with a clear error (not a cryptic crash)", async () => {
            await fs.mkdir(tmpDir, { recursive: true });
            // a non-zero UInt32 role count followed by garbage → decoding overruns
            await fs.writeFile(filePath, Buffer.from([0x05, 0x00, 0x00, 0x00, 0xde, 0xad]));

            const loaded = new InMemoryIdentityMappingStore();
            const error = await loadFromBinaryFile(loaded, filePath).then(
                () => null,
                (err: Error) => err
            );
            if (!error) throw new Error("expected loadFromBinaryFile to reject");
            error.message.should.match(/corrupt or truncated/);
            error.message.should.containEql(filePath);
        });

        it("should create parent directories", async () => {
            const deepPath = path.join(tmpDir, "a", "b", "c", "roles.bin");
            const store = new InMemoryIdentityMappingStore();
            store.addIdentity(
                SecurityAdmin,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.UserName,
                    criteria: "deep"
                })
            );

            await saveToBinaryFile(store, deepPath);

            const loaded = new InMemoryIdentityMappingStore();
            await loadFromBinaryFile(loaded, deepPath);
            loaded.getIdentitiesForRole(SecurityAdmin).should.have.length(1);
        });
    });
});
