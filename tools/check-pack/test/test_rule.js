/**
 * Unit tests for the packaging rule.
 *
 * The npm call is injected, so these run in milliseconds and assert on the logic rather
 * than on whether npm is installed. The shapes below are the ones this repo actually has:
 * a plain main+types package, a browser condition, and the nested exports map that
 * node-opcua-transport carries.
 *
 * Run: node test/test_rule.js
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { declaredEntryPoints, missingEntryPoints, publishablePackages, analyze, exitCode, formatReport } from "../src/rule.js";

// --- what a manifest promises -------------------------------------------------------

test("collects main, types, typings and module", () => {
    const found = declaredEntryPoints({ main: "./dist/index.js", types: "./dist/index.d.ts", typings: "./x.d.ts", module: "./esm/index.js" });
    assert.deepEqual(found.map((f) => f.field).sort(), ["main", "module", "types", "typings"]);
});

test("collects a browser string and a browser mapping", () => {
    assert.equal(declaredEntryPoints({ browser: "./dist/index.browser.js" }).length, 1);
    const mapped = declaredEntryPoints({ browser: { "./dist/fs.js": "./dist/fs.browser.js" } });
    assert.equal(mapped.length, 1);
    assert.equal(mapped[0].target, "./dist/fs.browser.js");
});

test("walks a nested exports map, the shape node-opcua-transport uses", () => {
    const pkg = {
        exports: {
            ".": {
                browser: { types: "./dist/source/index.browser.d.ts", default: "./dist/source/index.browser.js" },
                types: "./dist/source/index.d.ts",
                require: "./dist/source/index.js",
                default: "./dist/source/index.js"
            },
            "./dist/test_helpers": { types: "./dist/test_helpers/index.d.ts", default: "./dist/test_helpers/index.js" }
        }
    };
    const targets = declaredEntryPoints(pkg).map((f) => f.target);
    assert.ok(targets.includes("./dist/source/index.browser.js"));
    assert.ok(targets.includes("./dist/test_helpers/index.js"));
    // 5 leaves under "." (browser.types, browser.default, types, require, default)
    // plus 2 under "./dist/test_helpers"
    assert.equal(declaredEntryPoints(pkg).length, 7);
});

test("a manifest promising nothing yields nothing", () => {
    assert.deepEqual(declaredEntryPoints({ name: "x", version: "1" }), []);
});

// --- comparing against what npm would ship -------------------------------------------

test("passes when every promised file is shipped", () => {
    const pkg = { main: "./dist/index.js", types: "./dist/index.d.ts" };
    assert.deepEqual(missingEntryPoints(pkg, ["dist/index.js", "dist/index.d.ts", "LICENSE"]), []);
});

test("catches a main that is not in the tarball", () => {
    const pkg = { main: "./dist/index.js" };
    const missing = missingEntryPoints(pkg, ["LICENSE", "README.md"]);
    assert.equal(missing.length, 1);
    assert.equal(missing[0].field, "main");
});

test("catches an exports condition pointing at an unshipped file", () => {
    const pkg = { main: "./dist/index.js", exports: { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" } } };
    const missing = missingEntryPoints(pkg, ["dist/index.js"]);
    assert.equal(missing.length, 1);
    assert.match(missing[0].field, /exports/);
    assert.equal(missing[0].target, "./dist/index.d.ts");
});

test("leading ./ is not significant either way", () => {
    assert.deepEqual(missingEntryPoints({ main: "dist/index.js" }, ["dist/index.js"]), []);
    assert.deepEqual(missingEntryPoints({ main: "./dist/index.js" }, ["dist/index.js"]), []);
});

test("a bare specifier in exports is a redirect to another package, not our file", () => {
    const pkg = { exports: { "./polyfill": "node-opcua-utils/polyfill" } };
    assert.deepEqual(missingEntryPoints(pkg, []), []);
});

// --- package discovery ----------------------------------------------------------------

function withTree(files, fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-pack-"));
    try {
        for (const [rel, content] of Object.entries(files)) {
            const full = path.join(root, rel);
            fs.mkdirSync(path.dirname(full), { recursive: true });
            fs.writeFileSync(full, content);
        }
        return fn(root);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

test("private packages are skipped, publishable ones are not", () => {
    withTree(
        {
            "packages/a/package.json": JSON.stringify({ name: "a", main: "./dist/index.js" }),
            "packages/b/package.json": JSON.stringify({ name: "b", private: true, main: "./dist/index.js" }),
            "packages/c/README.md": "no manifest here"
        },
        (root) => {
            const found = publishablePackages(root);
            assert.deepEqual(found.map((p) => p.name), ["a"]);
        }
    );
});

test("end to end with an injected packer", () => {
    withTree(
        {
            "packages/good/package.json": JSON.stringify({ name: "good", main: "./dist/index.js" }),
            "packages/bad/package.json": JSON.stringify({ name: "bad", main: "./dist/index.js", types: "./dist/index.d.ts" })
        },
        (root) => {
            const pack = (dir) => (dir.endsWith("good") ? ["dist/index.js"] : ["dist/index.js"]);
            const result = analyze({ repoRoot: root, pack });
            assert.equal(result.scanned, 2);
            assert.equal(result.findings.length, 1);
            assert.equal(result.findings[0].name, "bad");
            assert.equal(exitCode(result), 1);
            assert.match(formatReport(result), /not in the tarball/);
        }
    );
});

test("a package that cannot be packed is a failure, not a silent pass", () => {
    withTree({ "packages/a/package.json": JSON.stringify({ name: "a", main: "./dist/index.js" }) }, (root) => {
        const pack = () => {
            throw new Error("npm exploded");
        };
        const result = analyze({ repoRoot: root, pack });
        assert.equal(result.failures.length, 1);
        assert.equal(exitCode(result), 1);
        assert.match(formatReport(result), /could not be packed/);
    });
});

test("a clean tree reports clean", () => {
    withTree({ "packages/a/package.json": JSON.stringify({ name: "a", main: "./dist/index.js" }) }, (root) => {
        const result = analyze({ repoRoot: root, pack: () => ["dist/index.js"] });
        assert.equal(exitCode(result), 0);
        assert.match(formatReport(result), /every declared entry point is in the tarball/);
    });
});
