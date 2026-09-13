/**
 * Tests for the check-erasable rule.
 *
 * The "does not flag" cases matter more than the "flags" ones here. Every shape below that
 * is accepted was run through `node --experimental-strip-types` first: `declare enum`,
 * `declare module`, `as` casts and ordinary parameters all load, so flagging them would
 * send someone to rewrite code that already works.
 */
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyze, exitCode, findViolations, formatReport, IGNORE_MARKER, REMEDIES } from "../src/rule.js";

const kinds = (src) => findViolations(src).map((v) => v.kind);

function withTree(files, fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-erasable-"));
    try {
        for (const [rel, contents] of Object.entries(files)) {
            const full = path.join(root, rel);
            fs.mkdirSync(path.dirname(full), { recursive: true });
            fs.writeFileSync(full, contents);
        }
        fn(root);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

// ── what it flags: the five shapes Node rejects ─────────────────────────────────────

test("an enum is flagged", () => {
    assert.deepEqual(kinds("enum Color { Red = 1 }"), ["enum"]);
});

test("a namespace with a body is flagged", () => {
    assert.deepEqual(kinds("namespace N { export const x = 1; }"), ["namespace"]);
});

test("a parameter property is flagged", () => {
    assert.deepEqual(kinds("class C { constructor(private x: number) {} }"), ["param-property"]);
});

test("an angle-bracket assertion is flagged", () => {
    assert.deepEqual(kinds("const n = <number>value;"), ["angle-cast"]);
});

test("import= and export= are flagged", () => {
    assert.deepEqual(kinds('import fs = require("node:fs");'), ["import="]);
    assert.deepEqual(kinds("export = thing;"), ["export="]);
});

test("readonly alone still makes a parameter property", () => {
    assert.deepEqual(kinds("class C { constructor(readonly x: number) {} }"), ["param-property"]);
});

// ── what it must not flag ───────────────────────────────────────────────────────────

test("declare forms emit nothing and are erasable", () => {
    assert.deepEqual(kinds("declare enum E { A }"), []);
    assert.deepEqual(kinds("declare namespace N { const x: number; }"), []);
});

test("an ambient module declaration is not a namespace", () => {
    assert.deepEqual(kinds('declare module "x" { const y: number; }'), []);
});

test("an `as` cast is erasable", () => {
    assert.deepEqual(kinds("const n = value as number;"), []);
});

test("an ordinary constructor parameter is not a parameter property", () => {
    assert.deepEqual(kinds("class C { constructor(x: number) {} }"), []);
});

test("a type-only construct is erasable", () => {
    assert.deepEqual(kinds("type T = { a: number };\ninterface I { b: string }\nconst x = 1 as const;"), []);
});

test("the words appear in prose without being syntax", () => {
    assert.deepEqual(kinds('// the enum and namespace below are gone\nconst s = "enum namespace";'), []);
});

test("a less-than comparison is not an angle cast", () => {
    assert.deepEqual(kinds("const b = a < b && c > d;"), []);
});

// ── the marker ──────────────────────────────────────────────────────────────────────

test("the marker exempts a line but the violation is still seen", () => {
    const src = `enum E { A } // ${IGNORE_MARKER} - deliberate`;
    const found = findViolations(src);
    assert.equal(found.length, 1);
    assert.equal(found[0].ignored, true);
});

// ── scope: test trees only ──────────────────────────────────────────────────────────

test("scans test trees and ignores library source", () => {
    withTree(
        {
            "packages/p/test/test_a.ts": "enum E { A }",
            "packages/p/test_helpers/helper.ts": "class C { constructor(private x: number) {} }",
            "packages/p/source/lib.ts": "enum NotReported { A }",
            "packages/p/dist/lib.js": "var x = 1;"
        },
        (root) => {
            const result = analyze({ repoRoot: root });
            assert.equal(result.scanned, 2);
            assert.deepEqual(
                result.findings.map((f) => f.kind).sort(),
                ["enum", "param-property"]
            );
            assert.ok(!result.findings.some((f) => f.file.includes("/source/")));
            assert.equal(exitCode(result), 1);
        }
    );
});

test("a clean test tree passes", () => {
    withTree({ "packages/p/test/test_a.ts": "const E = { A: 1 } as const;" }, (root) => {
        const result = analyze({ repoRoot: root });
        assert.equal(result.findings.length, 0);
        assert.equal(exitCode(result), 0);
        assert.match(formatReport(result), /all erasable/);
    });
});

test("a .d.ts in a test tree is not scanned", () => {
    withTree({ "packages/p/test/types.d.ts": "declare enum E { A }" }, (root) => {
        assert.equal(analyze({ repoRoot: root }).scanned, 0);
    });
});

test("--package narrows to one package", () => {
    withTree(
        {
            "packages/a/test/test_a.ts": "enum E { A }",
            "packages/b/test/test_b.ts": "enum E { A }"
        },
        (root) => {
            const result = analyze({ repoRoot: root, packageFilter: "a" });
            assert.equal(result.scanned, 1);
            assert.equal(result.findings.length, 1);
        }
    );
});

// ── the report ──────────────────────────────────────────────────────────────────────

test("the report names a remedy for every kind it reports", () => {
    withTree({ "packages/p/test/test_a.ts": "enum E { A }\nconst n = <number>v;" }, (root) => {
        const report = formatReport(analyze({ repoRoot: root }));
        assert.match(report, /ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX/);
        assert.match(report, new RegExp(REMEDIES.enum.slice(0, 20)));
        assert.match(report, new RegExp(REMEDIES["angle-cast"].replace(/[`]/g, "")));
    });
});
