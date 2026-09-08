import should from "should";
import { ReleaseMatrix, type ReleaseSet } from "../source/index.js";
import type { RegistryClient, VersionDocument } from "../source/registry.js";
import { newerReleaseAvailable, resolveLatest, resolveManifestRelease, resolveRelease } from "../source/resolve.js";
import { r2179, r2181_0, r2181_1 } from "./test_release_matrix.js";

/** a registry that has published these releases, and counts what is read from it */
function fakeRegistry(published: ReleaseSet[]) {
    const reads: string[] = [];
    const client: RegistryClient = {
        async versionDocument(version): Promise<VersionDocument | undefined> {
            reads.push(version);
            const sorted = [...published].sort((a, b) => (a.release < b.release ? 1 : -1));
            const set = version === "latest" ? sorted[0] : published.find((p) => p.release === version);
            return set && { version: set.release, nodeOpcuaRelease: set };
        },
        async versions() {
            return [...published].map((p) => p.release).sort((a, b) => (a < b ? 1 : -1));
        }
    };
    return { client, reads };
}

describe("resolveRelease", () => {
    it("answers from the matrix without touching the registry when the release is loaded", async () => {
        const { client, reads } = fakeRegistry([r2179, r2181_0, r2181_1]);
        const matrix = new ReleaseMatrix([r2181_1]);
        (await resolveRelease("2.181.1", matrix, client)).release.should.eql("2.181.1");
        reads.should.eql([]);
    });
    it("reads an older release from the registry and remembers it", async () => {
        const { client, reads } = fakeRegistry([r2179, r2181_0, r2181_1]);
        const matrix = new ReleaseMatrix([r2181_1]);
        (await resolveRelease("2.179.0", matrix, client)).external["node-opcua-crypto"].should.eql("5.9.0");
        await resolveRelease("2.179.0", matrix, client);
        reads.should.eql(["2.179.0"]);
        matrix.releases().should.eql(["2.181.1", "2.179.0"]);
    });
    it("refuses a release that was never published, and any other release when offline", async () => {
        const { client } = fakeRegistry([r2181_1]);
        const matrix = new ReleaseMatrix([r2181_1]);
        await resolveRelease("2.170.0", matrix, client).should.be.rejectedWith(/not published/);
        await resolveRelease("2.179.0", matrix, client, { offline: true }).should.be.rejectedWith(/--offline/);
    });
});

describe("resolveLatest", () => {
    it("takes the newest release from the registry even when the bundled copy is older", async () => {
        const { client } = fakeRegistry([r2179, r2181_0, r2181_1]);
        const matrix = new ReleaseMatrix([r2179]); // an old copy of the tool
        (await resolveLatest(matrix, client)).release.should.eql("2.181.1");
    });
    it("falls back to the bundled set offline or when the registry fails, and says so", async () => {
        const matrix = new ReleaseMatrix([r2179]);
        (await resolveLatest(matrix, fakeRegistry([]).client, { offline: true })).release.should.eql("2.179.0");
        const broken: RegistryClient = {
            versionDocument: async () => {
                throw new Error("HTTP 503");
            },
            versions: async () => []
        };
        const warnings: string[] = [];
        (await resolveLatest(matrix, broken, {}, (m) => warnings.push(m))).release.should.eql("2.179.0");
        warnings[0].should.match(/HTTP 503.*bundled set/);
    });
});

describe("newerReleaseAvailable", () => {
    it("names the newest published release when the bundled copy is older, and stays quiet otherwise", async () => {
        const { client } = fakeRegistry([r2179, r2181_0, r2181_1]);
        should(await newerReleaseAvailable(new ReleaseMatrix([r2179]), client)).eql("2.181.1");
        ((await newerReleaseAvailable(new ReleaseMatrix([r2181_1]), client)) === undefined).should.eql(true);
        ((await newerReleaseAvailable(new ReleaseMatrix([r2179]), client, { offline: true })) === undefined).should.eql(true);
    });
});

describe("resolveManifestRelease", () => {
    const registry = () => fakeRegistry([r2179, r2181_0, r2181_1]);

    it("finds the release locally when the bundled set already fits", async () => {
        const { client, reads } = registry();
        const json = { dependencies: { "node-opcua": "2.181.1", "node-opcua-debug": "2.181.0" } };
        should(await resolveManifestRelease(json, new ReleaseMatrix([r2181_1]), client)).eql("2.181.1");
        reads.should.eql([]);
    });
    it("reads the release named by the node-opcua pin when the bundled set is another one", async () => {
        const { client, reads } = registry();
        const json = { dependencies: { "node-opcua": "2.179.0", "node-opcua-debug": "2.179.0" } };
        should(await resolveManifestRelease(json, new ReleaseMatrix([r2181_1]), client)).eql("2.179.0");
        reads.should.eql(["2.179.0"]);
    });
    it("prefers the release named by the node-opcua pin when it fits, even if a newer release fits too", async () => {
        // node-opcua stayed at 2.181.0 in release 2.181.1, so both releases fit these pins;
        // the one named by the pin costs one read and is what the user means by "I am on 2.181.0"
        const r2181_1b: ReleaseSet = { ...r2181_1, packages: { ...r2181_1.packages, "node-opcua": "2.181.0" } };
        const { client, reads } = fakeRegistry([r2179, r2181_0, r2181_1b]);
        const json = { dependencies: { "node-opcua": "2.181.0", "node-opcua-debug": "2.181.0", "node-opcua-crypto": "5.10.1" } };
        should(await resolveManifestRelease(json, new ReleaseMatrix([r2179]), client)).eql("2.181.0");
        reads.should.eql(["2.181.0"]);
    });
    it("walks the published versions when the release named by the node-opcua pin does not fit", async () => {
        // release 2.181.1 bumped node-opcua-debug but not node-opcua: a manifest on it pins
        // node-opcua 2.181.0, and the set named 2.181.0 has the older debug
        const r2181_1b: ReleaseSet = {
            ...r2181_1,
            packages: { ...r2181_1.packages, "node-opcua": "2.181.0", "node-opcua-debug": "2.181.1" }
        };
        const { client, reads } = fakeRegistry([r2179, r2181_0, r2181_1b]);
        const json = { dependencies: { "node-opcua": "2.181.0", "node-opcua-debug": "2.181.1" } };
        should(await resolveManifestRelease(json, new ReleaseMatrix([r2179]), client)).eql("2.181.1");
        reads.should.eql(["2.181.0", "2.181.1"]);
    });
    it("gives up cleanly on pins that belong to no published release, and never reads offline", async () => {
        const { client, reads } = registry();
        const json = { dependencies: { "node-opcua": "2.190.0" } };
        ((await resolveManifestRelease(json, new ReleaseMatrix([r2181_1]), client)) === null).should.eql(true);
        ((await resolveManifestRelease(json, new ReleaseMatrix([r2181_1]), client, { offline: true })) === null).should.eql(true);
        reads.should.containEql("2.190.0");
    });
});
