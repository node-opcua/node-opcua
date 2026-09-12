/**
 * Unit tests for the package-shape rule.
 *
 * The tool results are fabricated, so these run in milliseconds and assert on the ratchet rather
 * than on publint and attw themselves (those have their own test suites, and packing 113 packages
 * is the CI job's work, not a unit test's).
 *
 * Run: node test/test_rule.js
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { evaluate, exitCode, formatReport, publishableTargets, readBaseline, writeBaseline } from "../src/rule.js";

const ok = { ok: true, output: "" };
const bad = (output = "boom") => ({ ok: false, output });

test("a green package is not a finding", () => {
    const result = evaluate([{ name: "a", publint: ok, attw: ok }], new Set());
    assert.deepEqual(result.failures, []);
    assert.equal(exitCode(result), 0);
    assert.match(formatReport(result), /1 packages checked, 0 grandfathered/);
});

test("a package failing publint is reported, with the tool named", () => {
    const result = evaluate([{ name: "a", publint: bad("pkg.bin is not executable"), attw: ok }], new Set());
    assert.equal(result.failures.length, 1);
    assert.deepEqual(result.failures[0].tools, ["publint"]);
    assert.match(formatReport(result), /pkg\.bin is not executable/);
    assert.equal(exitCode(result), 1);
});

test("a package failing both tools names both", () => {
    const result = evaluate([{ name: "a", publint: bad(), attw: bad() }], new Set());
    assert.deepEqual(result.failures[0].tools, ["publint", "attw"]);
});

test("a baselined failure is grandfathered, not a finding", () => {
    const result = evaluate([{ name: "a", publint: bad(), attw: ok }], new Set(["a"]));
    assert.deepEqual(result.failures, []);
    assert.equal(exitCode(result), 0);
    assert.equal(result.grandfathered, 1);
});

test("a new package failing is a finding even while others are baselined", () => {
    const result = evaluate(
        [
            { name: "old", publint: bad(), attw: ok },
            { name: "new", publint: ok, attw: bad() }
        ],
        new Set(["old"])
    );
    assert.deepEqual(
        result.failures.map((f) => f.name),
        ["new"]
    );
    assert.equal(exitCode(result), 1);
});

test("a repaired package still in the baseline is a note, not a failure", () => {
    const result = evaluate([{ name: "a", publint: ok, attw: ok }], new Set(["a"]));
    assert.deepEqual(result.fixed, ["a"]);
    assert.equal(exitCode(result), 0);
    assert.match(formatReport(result), /green but still baselined/);
});

test("the report truncates a long tool output", () => {
    const long = Array.from({ length: 200 }, (_, i) => `line ${i}`).join("\n");
    const report = formatReport(evaluate([{ name: "a", publint: bad(long), attw: ok }], new Set()));
    assert.ok(report.split("\n").length < 60, "report should not dump hundreds of lines");
});

// --- workspace scanning and the baseline file ----------------------------------------------

function makeRepo(packages) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "pkg-shape-"));
    fs.mkdirSync(path.join(root, "packages"), { recursive: true });
    fs.mkdirSync(path.join(root, "tools"), { recursive: true });
    for (const [name, spec] of Object.entries(packages)) {
        const dir = path.join(root, "packages", name);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name, private: spec.private === true }));
    }
    return root;
}

test("private packages are not published, so they are out of scope", () => {
    const root = makeRepo({ a: {}, playground: { private: true } });
    assert.deepEqual(
        publishableTargets(root).map((t) => t.name),
        ["a"]
    );
});

test("the baseline round-trips and stays sorted", () => {
    const root = makeRepo({ a: {} });
    writeBaseline(root, ["zeta", "alpha"]);
    assert.deepEqual([...readBaseline(root)], ["alpha", "zeta"]);
    const written = JSON.parse(fs.readFileSync(path.join(root, "tools", "package-shape-baseline.json"), "utf8"));
    assert.deepEqual(written.failingPackages, ["alpha", "zeta"]);
});

test("a missing baseline file means nothing is grandfathered", () => {
    assert.equal(readBaseline(makeRepo({ a: {} })).size, 0);
});
