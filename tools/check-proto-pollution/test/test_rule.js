/**
 * Unit tests for the proto-pollution rule.
 *
 * The cases that matter: a plain computed write is flagged, a literal key is not, an
 * Object.create(null) target is not, a numeric for-loop index is not, a denylist guard
 * (the shape of the reference fix) clears the flag, and the ignore marker opts one line out.
 *
 * Run: node test/test_rule.js
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { findViolations, analyze, currentBaseline, newFindings, exitCode, formatReport, IGNORE_MARKER } from "../src/rule.js";

const FILE = "test.ts";
const find = (text) => findViolations(text, FILE);

function withTree(files, fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-pp-"));
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

test("a plain computed-key write on a plain object is a violation", () => {
    const v = find("const map = {};\nmap[fieldName] = value;\n");
    assert.equal(v.length, 1);
    assert.equal(v[0].line, 2);
});

test("a computed-key write on a class instance (this[x] = ...) is a violation", () => {
    const v = find("class C { set(name, v) { this[name] = v; } }\n");
    assert.equal(v.length, 1);
});

test("a string literal key is not computed and is not flagged", () => {
    assert.equal(find('obj["name"] = 1;\n').length, 0);
});

test("a numeric literal key is not flagged", () => {
    assert.equal(find("obj[0] = 1;\n").length, 0);
});

test("a for-loop numeric counter used as an array index is not flagged", () => {
    const text = "for (let i = 0; i < n; i++) { arr[i] = compute(i); }\n";
    assert.equal(find(text).length, 0);
});

test("an Object.create(null) target is not flagged", () => {
    const text = "const map = Object.create(null);\nmap[key] = value;\n";
    assert.equal(find(text).length, 0);
});

test("a guarding if-statement that returns/throws before the write clears the flag", () => {
    const text = [
        'if (key === "__proto__" || key === "constructor" || key === "prototype") {',
        "    continue;",
        "}",
        "obj[key] = value;",
        ""
    ].join("\n");
    assert.equal(find(text).length, 0);
});

test("wrapping the write in an if that checks the key clears the flag", () => {
    const text = 'if (key !== "__proto__") {\n    obj[key] = value;\n}\n';
    assert.equal(find(text).length, 0);
});

test("a denylist check on a DIFFERENT identifier does not clear the flag", () => {
    const text = 'if (other === "__proto__") { return; }\nobj[key] = value;\n';
    assert.equal(find(text).length, 1);
});

test("the ignore marker opts one line out", () => {
    const text = `obj[key] = value; // ${IGNORE_MARKER} - key is drawn from a fixed enum\n`;
    assert.equal(find(text).length, 0);
});

test("Object.defineProperty is different syntax and is never matched", () => {
    const text = "Object.defineProperty(obj, key, { value, writable: true, enumerable: true, configurable: true });\n";
    assert.equal(find(text).length, 0);
});

test("a key built from a template literal is still flagged (it is not a literal)", () => {
    assert.equal(find("obj[`${prefix}${name}`] = value;\n").length, 1);
});

test("analyze walks the package trees, and the baseline suppresses known findings", () => {
    withTree({ "packages/p/source/a.ts": "const m = {};\nm[fieldName] = value;\n" }, (root) => {
        const result = analyze({ repoRoot: root });
        assert.equal(result.findings.length, 1);

        // with no baseline, it's a new finding and the gate fails
        assert.equal(exitCode(result, {}).valueOf(), 1);
        assert.match(formatReport(result, {}), /1 NEW computed-key write/);

        // once accepted into the baseline, the same finding no longer fails the gate
        const baseline = currentBaseline(result);
        assert.equal(newFindings(result, baseline).length, 0);
        assert.equal(exitCode(result, baseline), 0);
        assert.match(formatReport(result, baseline), /No new ones/);
    });
});

test("a genuinely new finding fails even with an existing, unrelated baseline entry", () => {
    withTree(
        {
            "packages/p/source/a.ts": "const m = {};\nm[fieldName] = value;\n",
            "packages/p/source/b.ts": "const n = {};\nn[otherName] = value2;\n"
        },
        (root) => {
            const resultA = analyze({ repoRoot: root, packageFilter: "p" });
            const aOnly = { ...currentBaseline({ findings: resultA.findings.filter((f) => f.file.endsWith("a.ts")) }) };
            const full = analyze({ repoRoot: root, packageFilter: "p" });
            assert.equal(newFindings(full, aOnly).length, 1);
            assert.equal(exitCode(full, aOnly), 1);
        }
    );
});

test("test/dist/generated trees are never scanned", () => {
    withTree(
        {
            "packages/p/test/a.ts": "const m = {};\nm[fieldName] = value;\n",
            "packages/p/dist/a.ts": "const m = {};\nm[fieldName] = value;\n",
            "packages/p/generated/a.ts": "const m = {};\nm[fieldName] = value;\n"
        },
        (root) => {
            assert.equal(analyze({ repoRoot: root }).findings.length, 0);
        }
    );
});
