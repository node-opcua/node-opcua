/**
 * Unit tests for the registry-state rule.
 *
 * The registry call is injected, so these run without network and assert on the logic.
 *
 * Run: node test/test_rule.js
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { analyze, expectedVersions, exitCode, formatReport } from "../src/rule.js";

function withTree(files, fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-published-"));
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

const tree = {
    "packages/a/package.json": JSON.stringify({ name: "a", version: "2.0.1" }),
    "packages/b/package.json": JSON.stringify({ name: "b", version: "2.0.0" }),
    "packages/versions/package.json": JSON.stringify({ name: "versions", version: "2.0.1", private: true }),
    "packages/fixture/package.json": JSON.stringify({ name: "fixture", version: "1.0.0", private: true })
};

/** a fabricated registry: the set of "name@version" it holds */
const registry = (...held) => async (name, version) => held.includes(`${name}@${version}`);

test("publishable packages are expected at the version of their manifest", () => {
    withTree(tree, (root) => {
        assert.deepEqual(
            expectedVersions(root).sort((x, y) => x.name.localeCompare(y.name)),
            [
                { name: "a", version: "2.0.1" },
                { name: "b", version: "2.0.0" }
            ]
        );
    });
});

test("a private package is expected only when the pass lifts it by name", () => {
    withTree(tree, (root) => {
        const names = expectedVersions(root, ["versions"]).map((e) => e.name).sort();
        assert.deepEqual(names, ["a", "b", "versions"]);
        // another private package stays out, as lerna keeps it unpublished
        assert.ok(!names.includes("fixture"));
    });
});

test("a complete release passes", async () => {
    const result = await analyze([{ name: "a", version: "2.0.1" }, { name: "b", version: "2.0.0" }], registry("a@2.0.1", "b@2.0.0"));
    assert.equal(exitCode(result), 0);
    assert.match(formatReport(result), /all 2 package versions are on the registry/);
});

test("an unchanged package is found at its older version, as lerna leaves it", async () => {
    // b was not bumped by this release: its manifest still names the version already published
    const result = await analyze([{ name: "b", version: "2.0.0" }], registry("b@2.0.0", "b@1.9.0"));
    assert.equal(exitCode(result), 0);
});

test("a version that is not on the registry fails and is named", async () => {
    const result = await analyze([{ name: "a", version: "2.0.1" }, { name: "b", version: "2.0.0" }], registry("b@2.0.0", "a@2.0.0"));
    assert.equal(exitCode(result), 1);
    assert.deepEqual(result.missing, [{ name: "a", version: "2.0.1" }]);
    assert.match(formatReport(result), /a@2\.0\.1/);
});

test("a registry that does not answer is not a pass", async () => {
    const has = async (name) => {
        if (name === "a") {
            throw new Error("registry answered 503");
        }
        return true;
    };
    const result = await analyze([{ name: "a", version: "2.0.1" }, { name: "b", version: "2.0.0" }], has);
    assert.equal(exitCode(result), 2);
    assert.match(formatReport(result), /did not answer/);
});

test("the queries run with a bounded concurrency", async () => {
    let running = 0;
    let peak = 0;
    const has = async () => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, 2));
        running--;
        return true;
    };
    const expected = Array.from({ length: 20 }, (_, i) => ({ name: `p${i}`, version: "1.0.0" }));
    const result = await analyze(expected, has, 4);
    assert.equal(exitCode(result), 0);
    assert.ok(peak <= 4, `peak ${peak}`);
});
