/**
 * Tests for the check-c8-ignore rule.
 *
 * The "does not flag" cases pin the shapes a plain text substitution would get wrong: the
 * hint inside a string, inside a template literal, and inside a block comment that documents
 * the convention (this repository's own tooling does exactly that).
 */
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyze, exitCode, findViolations, fixText, formatReport, IGNORE_MARKER } from "../src/rule.js";

function withTree(files, fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-c8-ignore-"));
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

// ── what it flags ───────────────────────────────────────────────────────────────

test("flags // c8 ignore next", () => {
    const v = findViolations("// c8 ignore next\nif (never) { boom(); }\n");
    assert.equal(v.length, 1);
    assert.equal(v[0].line, 1);
});

test("flags the counted and bracketing forms", () => {
    const v = findViolations("// c8 ignore next 3\na();\n// c8 ignore start\nb();\n// c8 ignore stop\n");
    assert.equal(v.length, 3);
});

test("flags the older v8 spelling, which c8 also reads", () => {
    assert.equal(findViolations("// v8 ignore next\n").length, 1);
});

test("flags a trailing hint on a line of code", () => {
    const v = findViolations("const x = compute(); // c8 ignore next\n");
    assert.equal(v.length, 1);
});

// ── block forms that are equally inert ──────────────────────────────────────────
//
// Checked against a fixture in which every spelling guards an uncalled function: a block
// comment with no directive, and one saying `end` rather than `stop`, are both ignored by
// c8 and the guarded line is reported uncovered.

test("accepts a trailing reason after the directive, which c8 tolerates", () => {
    assert.deepEqual(findViolations("/* c8 ignore next: because reasons */\n"), []);
    assert.deepEqual(findViolations("/* c8 ignore next -- because reasons */\n"), []);
    assert.deepEqual(findViolations("/* c8 ignore next 1 : because reasons */\n"), []);
});

test("converts a line hint that carries a reason", () => {
    assert.equal(fixText("// c8 ignore next: why\n").text, "/* c8 ignore next: why */\n");
});

test("does not accept a directive that merely starts with one", () => {
    assert.equal(findViolations("/* c8 ignore nextish */\n").length, 1);
});

test("flags a block hint with no directive", () => {
    const v = findViolations("/* c8 ignore */\nif (never) { boom(); }\n");
    assert.equal(v.length, 1);
    assert.match(v[0].reason, /not one of next/);
    assert.equal(v[0].fixable, false);
});

test("flags a block hint saying end instead of stop", () => {
    const v = findViolations("/* c8 ignore end */\n");
    assert.equal(v.length, 1);
    assert.equal(v[0].fixable, true);
});

test("repairs end to stop", () => {
    assert.equal(fixText("/* c8 ignore end */\n").text, "/* c8 ignore stop */\n");
});

test("repairs a line comment saying end, in one step", () => {
    assert.equal(fixText("// c8 ignore end\n").text, "/* c8 ignore stop */\n");
});

test("leaves a directiveless hint alone rather than guessing", () => {
    const before = "/* c8 ignore */\n";
    assert.equal(fixText(before).text, before);
});

// ── what it does not flag ───────────────────────────────────────────────────────

test("does not flag the block form, which c8 reads", () => {
    assert.deepEqual(findViolations("/* c8 ignore next */\nif (never) { boom(); }\n"), []);
});

test("does not flag the hint inside a string", () => {
    assert.deepEqual(findViolations('const doc = "// c8 ignore next";\n'), []);
});

test("does not flag the hint inside a template literal", () => {
    assert.deepEqual(findViolations("const doc = `// c8 ignore next`;\n"), []);
});

test("does not flag prose inside a block comment", () => {
    assert.deepEqual(findViolations("/**\n * write // c8 ignore next and nothing happens\n */\n"), []);
});

test("does not flag an unrelated comment that merely says ignore", () => {
    assert.deepEqual(findViolations("// ignore the next line, it is fine\n"), []);
});

test("honours the opt-out marker", () => {
    const v = findViolations(`// c8 ignore next -- ${IGNORE_MARKER} - kept as prose\n`);
    assert.equal(v.length, 1);
    assert.equal(v[0].ignored, true);
});

// ── the fix ─────────────────────────────────────────────────────────────────────

test("rewrites the line form to the block form", () => {
    const { text, fixed } = fixText("// c8 ignore next\nif (never) { boom(); }\n");
    assert.equal(fixed, 1);
    assert.equal(text, "/* c8 ignore next */\nif (never) { boom(); }\n");
});

test("rewrites a trailing hint in place", () => {
    const { text } = fixText("const x = compute(); // c8 ignore next\n");
    assert.equal(text, "const x = compute(); /* c8 ignore next */\n");
});

test("rewrites several hints in one file without shifting offsets", () => {
    const { text, fixed } = fixText("// c8 ignore start\na();\n// c8 ignore stop\n");
    assert.equal(fixed, 2);
    assert.equal(text, "/* c8 ignore start */\na();\n/* c8 ignore stop */\n");
});

test("preserves indentation", () => {
    const { text } = fixText("function f() {\n    // c8 ignore next\n    return 1;\n}\n");
    assert.equal(text, "function f() {\n    /* c8 ignore next */\n    return 1;\n}\n");
});

test("leaves the string form untouched", () => {
    const before = 'const doc = "// c8 ignore next";\n';
    assert.equal(fixText(before).text, before);
});

test("refuses a hint that already contains a comment terminator", () => {
    const before = "// c8 ignore next */ odd\n";
    const v = findViolations(before);
    assert.equal(v[0].fixable, false);
    assert.equal(fixText(before).text, before);
});

test("the fix is idempotent", () => {
    const once = fixText("// c8 ignore next\na();\n").text;
    assert.equal(fixText(once).fixed, 0);
});

// ── end to end ──────────────────────────────────────────────────────────────────

test("analyze reports, and --fix clears, a tree", () => {
    withTree(
        {
            "package.json": JSON.stringify({ name: "w" }),
            "packages/pkg/package.json": JSON.stringify({ name: "pkg", type: "module", files: ["source"] }),
            "packages/pkg/source/a.ts": "// c8 ignore next\nexport const a = 1;\n"
        },
        (root) => {
            const before = analyze({ repoRoot: root });
            assert.equal(before.findings.length, 1);
            assert.equal(exitCode(before), 1);
            assert.match(formatReport(before), /single-line block comment/);

            const after = analyze({ repoRoot: root, write: true });
            assert.equal(after.fixedCount, 1);
            assert.equal(after.findings.length, 0);
            assert.equal(exitCode(after), 0);
            assert.match(fs.readFileSync(path.join(root, "packages/pkg/source/a.ts"), "utf8"), /\/\* c8 ignore next \*\//);
        }
    );
});
