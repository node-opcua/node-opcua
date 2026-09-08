import "should";
import {
    applyChanges,
    applyExpand,
    auditScripts,
    inferRelease,
    type PackageManifest,
    planBump,
    planCheck,
    planExpand,
    ReleaseMatrix,
    rewritePeerSpecifier
} from "../source/index.js";

const matrix = new ReleaseMatrix([
    {
        release: "2.181.1",
        date: "2026-09-05",
        packages: {
            "node-opcua": "2.181.1",
            "node-opcua-debug": "2.181.0",
            "node-opcua-pseudo-session": "2.181.1",
            "node-opcua-assert": "2.179.0",
            "node-opcua-nodeset-di": "2.181.0"
        },
        external: { "node-opcua-crypto": "5.10.1", "node-opcua-pki": "6.22.0" }
    },
    {
        release: "2.179.0",
        date: "2026-08-27",
        packages: {
            "node-opcua": "2.179.0",
            "node-opcua-debug": "2.179.0",
            "node-opcua-pseudo-session": "2.179.0",
            "node-opcua-assert": "2.179.0",
            "node-opcua-nodeset-di": "2.179.0"
        },
        external: { "node-opcua-crypto": "5.10.1", "node-opcua-pki": "6.21.0" }
    }
]);

describe("inferRelease", () => {
    it("trusts the node-opcua umbrella when it is pinned", () => {
        const json: PackageManifest = { dependencies: { "node-opcua": "2.179.0", "node-opcua-debug": "2.181.0" } };
        const r = inferRelease(json, matrix)!;
        r.release.should.eql("2.179.0");
        r.evidence.name.should.eql("node-opcua");
        r.outliers.map((o) => o.name).should.eql(["node-opcua-debug"]);
    });
    it("never lets a vote override a node-opcua pin the matrix does not know", () => {
        // node-opcua-assert 2.179.0 belongs to 2.181.1 too, but the umbrella says 2.180.0, a release not loaded
        const json: PackageManifest = { dependencies: { "node-opcua": "2.180.0", "node-opcua-assert": "2.179.0" } };
        (inferRelease(json, matrix) === null).should.eql(true);
    });
    it("picks the newest release carrying the umbrella's version when that version names no release", () => {
        const withUnbumpedUmbrella = new ReleaseMatrix([
            ...["2.181.1", "2.179.0"].map((r) => matrix.get(r)!),
            { release: "2.181.2", packages: { "node-opcua": "2.181.1", "node-opcua-debug": "2.181.2" }, external: {} }
        ]);
        // node-opcua 2.181.1 names release 2.181.1 and also belongs to 2.181.2: the named one wins
        inferRelease({ dependencies: { "node-opcua": "2.181.1" } }, withUnbumpedUmbrella)!.release.should.eql("2.181.1");
    });
    it("votes among the other packages otherwise, newest release wins a tie", () => {
        const json: PackageManifest = { dependencies: { "node-opcua-assert": "2.179.0", "node-opcua-nodeset-di": "2.181.0" } };
        inferRelease(json, matrix)!.release.should.eql("2.181.1");
    });
    it("ignores ranges and unknown versions", () => {
        (inferRelease({ dependencies: { "node-opcua": "^2.179.0" } }, matrix) === null).should.eql(true);
        (inferRelease({ dependencies: { "node-opcua": "1.0.0" } }, matrix) === null).should.eql(true);
        (inferRelease({ dependencies: { express: "4.0.0" } }, matrix) === null).should.eql(true);
    });
});

describe("planBump", () => {
    it("moves every managed dependency to the release's versions, external pins included, and leaves the rest alone", () => {
        const json: PackageManifest = {
            dependencies: {
                "node-opcua": "2.179.0",
                "node-opcua-debug": "^2.179.0",
                express: "4.0.0",
                "node-opcua-crypto": "5.10.1",
                "node-opcua-pki": "6.21.0"
            },
            devDependencies: { "node-opcua-assert": "2.179.0" }
        };
        const plan = planBump(json, matrix.latest(), matrix);
        plan.release.should.eql("2.181.1");
        plan.changes.should.eql([
            { field: "dependencies", name: "node-opcua", from: "2.179.0", to: "2.181.1" },
            { field: "dependencies", name: "node-opcua-debug", from: "^2.179.0", to: "2.181.0" },
            { field: "dependencies", name: "node-opcua-pki", from: "6.21.0", to: "6.22.0" }
        ]);
        plan.unknown.should.eql([]);
        applyChanges(json, plan.changes);
        json.dependencies!.should.eql({
            "node-opcua": "2.181.1",
            "node-opcua-debug": "2.181.0",
            express: "4.0.0",
            "node-opcua-crypto": "5.10.1",
            "node-opcua-pki": "6.22.0"
        });
        json.devDependencies!["node-opcua-assert"].should.eql("2.179.0"); // unchanged package, same version in both releases
    });
    it("reports a managed package the release does not carry", () => {
        const json: PackageManifest = { dependencies: { "node-opcua-nodeset-di": "2.179.0" } };
        const set = { release: "2.181.1", packages: { "node-opcua": "2.181.1" }, external: {} };
        planBump(json, set, matrix).unknown.should.eql([{ field: "dependencies", name: "node-opcua-nodeset-di" }]);
    });
    it("moves a peer range's floor without changing its shape", () => {
        rewritePeerSpecifier(">=2.170.0", "2.181.1").should.eql(">=2.181.1");
        rewritePeerSpecifier("^2.170.0", "2.181.1").should.eql("^2.181.1");
        rewritePeerSpecifier("~2.170.0", "2.181.1").should.eql("~2.181.1");
        rewritePeerSpecifier("2.170.0", "2.181.1").should.eql("2.181.1");
        rewritePeerSpecifier("*", "2.181.1").should.eql("*");
        rewritePeerSpecifier(">=2.170.0 <3", "2.181.1").should.eql(">=2.170.0 <3");
    });
    it("does not touch peerDependencies unless asked", () => {
        const json: PackageManifest = { peerDependencies: { "node-opcua": ">=2.170.0" } };
        planBump(json, matrix.latest(), matrix).changes.should.eql([]);
        planBump(json, matrix.latest(), matrix, ["peerDependencies"]).changes.should.eql([
            { field: "peerDependencies", name: "node-opcua", from: ">=2.170.0", to: ">=2.181.1" }
        ]);
    });
});

describe("planCheck", () => {
    it("accepts a coherent set with differing numbers", () => {
        const report = planCheck(
            { dependencies: { "node-opcua": "2.181.1", "node-opcua-debug": "2.181.0", "node-opcua-assert": "2.179.0" } },
            matrix
        );
        report.release!.should.eql("2.181.1");
        report.ok.should.eql(true);
    });
    it("flags a pin from another release, an external pin the release does not expect, a range, and an unknown package", () => {
        const report = planCheck(
            {
                dependencies: {
                    "node-opcua": "2.181.1",
                    "node-opcua-debug": "2.179.0",
                    "node-opcua-assert": "^2.179.0",
                    "node-opcua-pki": "6.21.0",
                    "node-opcua-something-else": "1.0.0"
                }
            },
            matrix
        );
        report.ok.should.eql(false);
        report.mismatches.should.eql([
            { field: "dependencies", name: "node-opcua-debug", actual: "2.179.0", expected: "2.181.0" },
            { field: "dependencies", name: "node-opcua-pki", actual: "6.21.0", expected: "6.22.0" }
        ]);
        report.ranges.map((r) => r.name).should.eql(["node-opcua-assert"]);
        report.unmanaged.map((u) => u.name).should.eql(["node-opcua-something-else"]);
    });
    it("fails, not passes, when the pins belong to a release the matrix does not know", () => {
        const report = planCheck({ dependencies: { "node-opcua": "2.190.0", "node-opcua-debug": "2.190.0" } }, matrix);
        (report.release === null).should.eql(true);
        report.unrecognised.should.eql(true);
        report.ok.should.eql(false);
        report.mismatches.should.eql([]);
    });
    it("ignores workspace links, whatever the package is called", () => {
        const report = planCheck(
            { dependencies: { "node-opcua": "2.181.1", "node-opcua-my-tool": "workspace:*", "node-opcua-debug": "link:../debug" } },
            matrix
        );
        report.ok.should.eql(true);
        report.unmanaged.should.eql([]);
        report.ranges.should.eql([]);
    });
    it("passes a manifest with no node-opcua pin at all", () => {
        const report = planCheck({ dependencies: { express: "4.0.0" } }, matrix);
        report.unrecognised.should.eql(false);
        report.ok.should.eql(true);
    });
    it("checks against a forced release", () => {
        const report = planCheck({ dependencies: { "node-opcua": "2.181.1" } }, matrix, "2.179.0");
        report.mismatches.should.eql([{ field: "dependencies", name: "node-opcua", actual: "2.181.1", expected: "2.179.0" }]);
    });
});

describe("planExpand", () => {
    const json: PackageManifest = {
        dependencies: { "node-opcua": "2.181.1", "@sterfive/opcua-optimized-client": "1.35.0" }
    };
    const requirements = [
        { requiredBy: "@sterfive/opcua-optimized-client@1.35.0", name: "node-opcua", range: ">=2.175.1" },
        { requiredBy: "@sterfive/opcua-optimized-client@1.35.0", name: "node-opcua-pseudo-session", range: ">=2.175.1" },
        { requiredBy: "@sterfive/opcua-optimized-client@1.35.0", name: "node-opcua-debug", range: ">=2.175.1" },
        { requiredBy: "@sterfive/other@1.0.0", name: "node-opcua-debug", range: ">=2.180.0" },
        { requiredBy: "@sterfive/other@1.0.0", name: "node-opcua-crypto", range: ">=5.0.0" }
    ];

    it("adds the missing managed peers at the release's versions, merging who requires them", () => {
        const plan = planExpand(json, matrix.latest(), matrix, requirements);
        plan.additions.should.eql([
            { name: "node-opcua-crypto", version: "5.10.1", requiredBy: ["@sterfive/other@1.0.0"] },
            {
                name: "node-opcua-debug",
                version: "2.181.0",
                requiredBy: ["@sterfive/opcua-optimized-client@1.35.0", "@sterfive/other@1.0.0"]
            },
            { name: "node-opcua-pseudo-session", version: "2.181.1", requiredBy: ["@sterfive/opcua-optimized-client@1.35.0"] }
        ]);
        plan.satisfied.should.eql([{ name: "node-opcua", version: "2.181.1" }]);
        plan.unmanaged.should.eql([]);
        plan.conflicts.should.eql([]);
    });
    it("adds an external package the release pins when a dependency requires it", () => {
        const plan = planExpand({ dependencies: { "node-opcua": "2.181.1" } }, matrix.latest(), matrix, [
            { requiredBy: "@sterfive/x@1.0.0", name: "node-opcua-crypto", range: ">=5.0.0" }
        ]);
        plan.additions.should.eql([{ name: "node-opcua-crypto", version: "5.10.1", requiredBy: ["@sterfive/x@1.0.0"] }]);
    });
    it("reports a peer range the release does not satisfy instead of adding a wrong version", () => {
        const older = matrix.get("2.179.0")!;
        const plan = planExpand(json, older, matrix, requirements);
        plan.conflicts.should.eql([
            { name: "node-opcua-debug", version: "2.179.0", range: ">=2.180.0", requiredBy: "@sterfive/other@1.0.0" }
        ]);
        // the same peer required with a satisfiable range by another package is still added
        plan.additions.map((a) => a.name).should.eql(["node-opcua-crypto", "node-opcua-debug", "node-opcua-pseudo-session"]);
    });
    it("writes the additions into dependencies, sorted", () => {
        const copy: PackageManifest = JSON.parse(JSON.stringify(json));
        applyExpand(copy, planExpand(copy, matrix.latest(), matrix, requirements));
        Object.keys(copy.dependencies!).should.eql([
            "@sterfive/opcua-optimized-client",
            "node-opcua",
            "node-opcua-crypto",
            "node-opcua-debug",
            "node-opcua-pseudo-session"
        ]);
        copy.dependencies!["node-opcua-debug"].should.eql("2.181.0");
    });
});

describe("auditScripts", () => {
    const warn = (command: string) => auditScripts({ scripts: { up: command } }).length;
    it("flags npm-check-updates invocations that would move the node-opcua family", () => {
        warn("ncu -u").should.eql(1);
        warn("npx npm-check-updates -u --target minor").should.eql(1);
        warn('ncu -u -f "node-opcua*"').should.eql(1);
    });
    it("accepts an invocation that excludes the family, or that filters it out", () => {
        warn('ncu -u -x "node-opcua*"').should.eql(0);
        warn("ncu -u --reject node-opcua*").should.eql(0);
        warn("ncu -u -x=node-opcua* -x @sterfive/*").should.eql(0);
        warn('ncu -u -f "@sterfive/*"').should.eql(0);
        warn("node-opcua-versions bump").should.eql(0);
    });
    it("names the script and the fix", () => {
        const [w] = auditScripts({ scripts: { "deps:update": "ncu -u", test: "mocha" } });
        w.script.should.eql("deps:update");
        w.fix.should.match(/-x "node-opcua\*"/);
    });
});
