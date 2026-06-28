import { promises as fs } from "node:fs";
import path from "node:path";
import { NodeId } from "node-opcua-nodeid";
import { IdentityCriteriaType, IdentityMappingRuleType } from "node-opcua-types";
import "should";
import {
    InMemoryIdentityMappingStore,
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
});
