/**
 * Unit tests for the build-graph rule.
 *
 * The fixtures are temporary directory trees rather than the real workspace, so the tests assert
 * on reachability logic and on the JSONC shapes this repo actually contains: a trailing comma in
 * every generated nodeset tsconfig, a BOM in node-opcua-debug, and include globs that carry a
 * /* inside a string literal.
 *
 * Run: node test/test_rule.js
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { stripJsonc, readTsconfig, referencePaths, resolveReference, reachablePackages, analyze, exitCode, formatReport } from "../src/rule.js";

// --- JSONC, as the repo writes it ---------------------------------------------------------

test("strips line and block comments", () => {
    assert.deepEqual(JSON.parse(stripJsonc('{ // a\n "a": 1 /* b */ }')), { a: 1 });
});

test("strips a trailing comma, which every generated nodeset tsconfig has", () => {
    assert.deepEqual(JSON.parse(stripJsonc('{ "include": ["source/*.ts",\n], "a": 1 }')), { include: ["source/*.ts"], a: 1 });
});

test("a glob inside a string is not a comment", () => {
    const text = '{ "include": ["source/**/*.ts"] }';
    assert.deepEqual(JSON.parse(stripJsonc(text)), { include: ["source/**/*.ts"] });
});

test("an escaped quote does not end the string", () => {
    assert.deepEqual(JSON.parse(stripJsonc('{ "a": "x\\"// y" }')), { a: 'x"// y' });
});

// --- references ---------------------------------------------------------------------------

test("reads reference paths and ignores malformed entries", () => {
    assert.deepEqual(referencePaths({ references: [{ path: "../a" }, {}, { path: "../b" }] }), ["../a", "../b"]);
    assert.deepEqual(referencePaths({}), []);
    assert.deepEqual(referencePaths(null), []);
});

test("a reference resolves whether it names the directory or the tsconfig", () => {
    const packagesDir = path.resolve("/repo/packages");
    const from = path.join(packagesDir, "node-opcua-client");
    assert.equal(resolveReference(from, "../node-opcua-variant", packagesDir), "node-opcua-variant");
    assert.equal(resolveReference(from, "../node-opcua-variant/tsconfig.json", packagesDir), "node-opcua-variant");
    assert.equal(resolveReference(from, "../node-opcua-types/tsconfig.pre.json", packagesDir), "node-opcua-types");
    assert.equal(resolveReference(from, "../../elsewhere", packagesDir), null);
});

// --- the closure on a fixture tree ---------------------------------------------------------

function makeRepo(packages, aggregateRefs) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "build-graph-"));
    const packagesDir = path.join(root, "packages");
    fs.mkdirSync(packagesDir, { recursive: true });
    fs.writeFileSync(
        path.join(packagesDir, "tsconfig.json"),
        JSON.stringify({ references: aggregateRefs.map((p) => ({ path: p })) })
    );
    for (const [name, spec] of Object.entries(packages)) {
        const dir = path.join(packagesDir, name);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name, private: spec.private === true }));
        if (spec.tsconfig !== false) {
            fs.writeFileSync(path.join(dir, "tsconfig.json"), JSON.stringify({ references: (spec.refs ?? []).map((p) => ({ path: p })) }));
        }
    }
    return root;
}

test("a package reached only through another package's references counts as built", () => {
    const root = makeRepo({ a: { refs: ["../b"] }, b: {} }, ["a"]);
    const reachable = reachablePackages(root);
    assert.deepEqual([...reachable].sort(), ["a", "b"]);
    assert.deepEqual(analyze({ repoRoot: root }).findings, []);
});

test("a publishable package nothing references is reported", () => {
    const root = makeRepo({ a: {}, orphan: {} }, ["a"]);
    const result = analyze({ repoRoot: root });
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].name, "orphan");
    assert.equal(exitCode(result), 1);
    assert.match(formatReport(result), /never built/);
});

test("a private package outside the graph is deliberate, not a finding", () => {
    const root = makeRepo({ a: {}, playground: { private: true } }, ["a"]);
    const result = analyze({ repoRoot: root });
    assert.deepEqual(result.findings, []);
    assert.equal(exitCode(result), 0);
});

test("a package with no tsconfig is not part of the build graph question", () => {
    const root = makeRepo({ a: {}, docsonly: { tsconfig: false } }, ["a"]);
    assert.deepEqual(analyze({ repoRoot: root }).findings, []);
});

test("a reference cycle terminates", () => {
    const root = makeRepo({ a: { refs: ["../b"] }, b: { refs: ["../a"] } }, ["a"]);
    assert.deepEqual([...reachablePackages(root)].sort(), ["a", "b"]);
});

test("a BOM does not hide a tsconfig's references", () => {
    const root = makeRepo({ a: { refs: ["../b"] }, b: {} }, ["a"]);
    const file = path.join(root, "packages", "a", "tsconfig.json");
    fs.writeFileSync(file, `﻿${fs.readFileSync(file, "utf8")}`);
    assert.deepEqual(referencePaths(readTsconfig(file)), ["../b"]);
    assert.deepEqual(analyze({ repoRoot: root }).findings, []);
});

test("the clean report names the counts", () => {
    const root = makeRepo({ a: {} }, ["a"]);
    assert.match(formatReport(analyze({ repoRoot: root })), /1 publishable packages, all reachable/);
});
