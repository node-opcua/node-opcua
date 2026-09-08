import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import should from "should";
import { bundledSet, compareVersions, isVersion, ReleaseMatrix, type ReleaseSet, satisfiesRange } from "../source/index.js";

export const r2179: ReleaseSet = {
    release: "2.179.0",
    date: "2026-08-27",
    packages: { "node-opcua": "2.179.0", "node-opcua-debug": "2.179.0", "node-opcua-assert": "2.179.0" },
    external: { "node-opcua-crypto": "5.9.0" }
};
export const r2181_0: ReleaseSet = {
    release: "2.181.0",
    date: "2026-09-05",
    packages: { "node-opcua": "2.181.0", "node-opcua-debug": "2.181.0", "node-opcua-assert": "2.179.0" },
    external: { "node-opcua-crypto": "5.10.1" }
};
export const r2181_1: ReleaseSet = {
    release: "2.181.1",
    date: "2026-09-05",
    packages: { "node-opcua": "2.181.1", "node-opcua-debug": "2.181.0", "node-opcua-assert": "2.179.0" },
    external: { "node-opcua-crypto": "5.10.1" }
};

describe("compareVersions", () => {
    it("orders numerically, not lexically", () => {
        compareVersions("2.181.1", "2.9.0").should.be.greaterThan(0);
        compareVersions("2.181.0", "2.181.1").should.be.lessThan(0);
        compareVersions("2.181.1", "2.181.1").should.eql(0);
    });
    it("puts a prerelease before its release", () => {
        compareVersions("2.181.1-beta.1", "2.181.1").should.be.lessThan(0);
    });
    it("rejects what is not a version", () => {
        isVersion("^2.181.1").should.eql(false);
        isVersion("2.181.1").should.eql(true);
        (() => compareVersions("latest", "2.0.0")).should.throw();
    });
});

describe("satisfiesRange", () => {
    it("handles the operators peer dependencies use", () => {
        satisfiesRange("2.181.0", ">=2.175.1").should.eql(true);
        satisfiesRange("2.174.0", ">=2.175.1").should.eql(false);
        satisfiesRange("2.181.0", "^2.175.1").should.eql(true);
        satisfiesRange("3.0.0", "^2.175.1").should.eql(false);
        satisfiesRange("2.175.9", "~2.175.1").should.eql(true);
        satisfiesRange("2.176.0", "~2.175.1").should.eql(false);
        satisfiesRange("2.181.0", "2.181.0").should.eql(true);
        satisfiesRange("2.181.0", "*").should.eql(true);
        satisfiesRange("2.181.0", ">=2.170.0 <3").should.eql(true);
        satisfiesRange("1.0.0", "^0.13.0 || >=2.0.0").should.eql(false);
        satisfiesRange("0.13.4", "^0.13.0 || >=2.0.0").should.eql(true);
    });
});

describe("ReleaseMatrix", () => {
    const matrix = new ReleaseMatrix([r2181_0, r2179, r2181_1]);

    it("lists releases newest first, whatever the order they were added", () => {
        matrix.releases().should.eql(["2.181.1", "2.181.0", "2.179.0"]);
        matrix.latest().release.should.eql("2.181.1");
    });
    it("knows the version of a package in a release, including unchanged ones", () => {
        should(matrix.versionOf("node-opcua-debug", "2.181.1")).eql("2.181.0");
        should(matrix.versionOf("node-opcua-assert", "2.181.1")).eql("2.179.0");
        (matrix.versionOf("node-opcua-nope", "2.181.1") === undefined).should.eql(true);
        (matrix.versionOf("node-opcua", "2.170.0") === undefined).should.eql(true);
    });
    it("finds every loaded release a version belonged to", () => {
        matrix.releasesOf("node-opcua-assert", "2.179.0").should.eql(["2.181.1", "2.181.0", "2.179.0"]);
        matrix.releasesOf("node-opcua-debug", "2.181.0").should.eql(["2.181.1", "2.181.0"]);
        matrix.releasesOf("node-opcua", "2.181.1").should.eql(["2.181.1"]);
    });
    it("manages the packages it has seen, external pins included", () => {
        matrix.manages("node-opcua-debug").should.eql(true);
        matrix.manages("node-opcua-crypto").should.eql(true);
        matrix.manages("node-opcua-unknown").should.eql(false);
        should(matrix.versionOf("node-opcua-crypto", "2.179.0")).eql("5.9.0");
    });
    it("never replaces a release already known: a release does not change", () => {
        const m = new ReleaseMatrix([r2179]);
        m.add({ ...r2179, packages: { "node-opcua": "9.9.9" } });
        should(m.versionOf("node-opcua", "2.179.0")).eql("2.179.0");
    });
    it("hands out copies, not its own objects", () => {
        const set = matrix.get("2.179.0")!;
        set.packages["node-opcua"] = "0.0.0";
        should(matrix.versionOf("node-opcua", "2.179.0")).eql("2.179.0");
    });
    it("is empty until a set is added", () => {
        (() => new ReleaseMatrix().latest()).should.throw(/empty/);
    });
});

describe("bundledSet", () => {
    it("reads the set of this package's own release from its manifest", () => {
        const set = bundledSet();
        set.release.should.eql(JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")).version);
        Object.keys(set.packages).length.should.be.greaterThan(50);
        set.packages["node-opcua"].should.match(/^\d+\.\d+\.\d+$/);
        set.external["node-opcua-crypto"].should.match(/^\d+\.\d+\.\d+$/);
    });
    it("refuses a manifest without a set", () => {
        const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "nov-")), "package.json");
        fs.writeFileSync(file, JSON.stringify({ name: "x", version: "1.0.0" }));
        (() => bundledSet(file)).should.throw(/no release set/);
    });
});
