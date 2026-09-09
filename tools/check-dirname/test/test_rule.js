/**
 * Tests for the dirname rule.
 *
 * Most of these pin what it must NOT flag. `__dirname` appears in comments throughout this
 * repository — including inside the very comment the rule tells you to write — so a gate that
 * cannot tell code from prose would be unusable, and a gate that fires on the anchor it
 * recommends would be absurd.
 */
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyze, exitCode, findViolations, formatReport, IGNORE_MARKER } from "../src/rule.js";

function withTree(files, fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-dirname-"));
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

test("flags a raw __dirname in an expression", () => {
    const v = findViolations('const p = path.join(__dirname, "..", "x.json");\n');
    assert.equal(v.length, 1);
    assert.equal(v[0].name, "__dirname");
    assert.equal(v[0].line, 1);
});

test("flags __filename too", () => {
    assert.equal(findViolations("const f = __filename;\nconsole.log(__filename);\n").length, 1);
});

test("flags a use inside a function, which is not the one-line-to-change pattern", () => {
    const src = ["function f() {", "    const here = __dirname;", "    return here;", "}", ""].join("\n");
    assert.equal(findViolations(src).length, 1);
});

test("reports every raw use, not just the first", () => {
    const src = ['const a = path.join(__dirname, "a");', 'const b = path.join(__dirname, "b");', ""].join("\n");
    assert.deepEqual(
        findViolations(src).map((v) => v.line),
        [1, 2]
    );
});

// ── what it leaves alone ────────────────────────────────────────────────────────

test("the module-scope anchor is the point of the rule, so it is not a finding", () => {
    assert.equal(findViolations("const here = __dirname;\n").length, 0);
});

test("the anchor may be named anything", () => {
    assert.equal(findViolations("const packageRoot = __dirname;\n").length, 0);
});

test("an anchor for __filename is equally fine", () => {
    assert.equal(findViolations("const self = __filename;\n").length, 0);
});

test("__dirname in a line comment is not code", () => {
    assert.equal(findViolations("// we cannot use __dirname here\nconst a = 1;\n").length, 0);
});

test("__dirname in a block comment is not code", () => {
    const src = ["/**", " * `import.meta.dirname` cannot be used yet, so `const here = __dirname;`", " */", "const a = 1;", ""].join(
        "\n"
    );
    assert.equal(findViolations(src).length, 0);
});

test("the comment the rule itself recommends does not trip it", () => {
    const src = [
        "// The one place this module learns where it sits on disk. `import.meta.dirname`",
        "// cannot be used while this package emits CommonJS (TS1470), so the ESM migration",
        "// has this single line to change rather than several scattered uses.",
        "const here = __dirname;",
        ""
    ].join("\n");
    assert.equal(findViolations(src).length, 0);
});

test("__dirname inside a string is not code", () => {
    assert.equal(findViolations('const s = "path.join(__dirname, x)";\n').length, 0);
});

test("a guarded use is already ESM-safe and browser-safe", () => {
    const src = 'const f = typeof __filename === "undefined" ? "<browser>" : __filename;\n';
    assert.equal(findViolations(src).length, 0);
});

test("a property named __dirname is not the global", () => {
    assert.equal(findViolations("const p = options.__dirname;\n").length, 0);
});

// ── opting out ──────────────────────────────────────────────────────────────────

test("the marker exempts a use, and it is counted rather than hidden", () => {
    withTree(
        {
            "packages/p/source/a.ts": `const p = path.join(__dirname, "x"); // ${IGNORE_MARKER} - deliberate\n`
        },
        (root) => {
            const result = analyze({ repoRoot: root });
            assert.equal(result.findings.length, 0);
            assert.equal(result.exempt, 1);
            assert.equal(exitCode(result), 0);
            assert.match(formatReport(result), /1 exempted/);
        }
    );
});

// ── walking the tree ────────────────────────────────────────────────────────────

test("scans what each package publishes, not a hardcoded source/src", () => {
    withTree(
        {
            "packages/p/package.json": JSON.stringify({ name: "p", files: ["api", "source_nodejs"] }),
            "packages/p/api/a.ts": "const p = __dirname;\nfoo(__dirname);\n",
            "packages/p/source_nodejs/b.ts": "bar(__filename);\n"
        },
        (root) => {
            const result = analyze({ repoRoot: root });
            assert.equal(result.scanned, 2);
            assert.equal(result.findings.length, 2);
            assert.equal(exitCode(result), 1);
        }
    );
});

test("test trees are not scanned: this is about what ships", () => {
    withTree({ "packages/p/test/a.ts": 'foo(path.join(__dirname, "x"));\n' }, (root) => {
        assert.equal(analyze({ repoRoot: root }).findings.length, 0);
    });
});

test("declaration files are not scanned", () => {
    withTree({ "packages/p/source/a.d.ts": "declare const x: typeof __dirname;\n" }, (root) => {
        assert.equal(analyze({ repoRoot: root }).scanned, 0);
    });
});

test("--package narrows the scan", () => {
    withTree(
        {
            "packages/p/source/a.ts": "foo(__dirname);\n",
            "packages/q/source/a.ts": "foo(__dirname);\n"
        },
        (root) => {
            assert.equal(analyze({ repoRoot: root, packageFilter: "p" }).findings.length, 1);
        }
    );
});

test("the report names the count it scanned, so a narrow scope is visible", () => {
    withTree({ "packages/p/source/a.ts": "const a = 1;\n" }, (root) => {
        assert.match(formatReport(analyze({ repoRoot: root })), /1 files scanned/);
    });
});
