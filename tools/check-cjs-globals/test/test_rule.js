/**
 * Tests for the check-cjs-globals rule.
 *
 * Most of the "does not flag" tests pin exactly the shapes the brief calls out as false
 * positives this gate must not produce: a bound `require`, a parameter named `module`, a
 * nested CommonJS scope, and the marker.
 */
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyze, exitCode, findViolations, fixText, formatReport, IGNORE_MARKER, nearestModuleType } from "../src/rule.js";

function withTree(files, fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-cjs-globals-"));
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

test("flags require.main === module", () => {
    const v = findViolations("if (require.main === module) {\n    run();\n}\n");
    const names = v.map((x) => x.name).sort();
    assert.deepEqual(names, ["module", "require"]);
});

test("flags bare module.exports", () => {
    const v = findViolations("module.exports = { foo: 1 };\n");
    assert.equal(v.length, 1);
    assert.equal(v[0].name, "module");
});

test("flags exports.foo = 1", () => {
    const v = findViolations("exports.foo = 1;\n");
    assert.equal(v.length, 1);
    assert.equal(v[0].name, "exports");
});

test("flags module.parent and module.id too", () => {
    assert.equal(findViolations("console.log(module.parent, module.id);\n").length, 2);
});

test("reports every use, not just the first", () => {
    const src = ["console.log(require);", "console.log(require);", ""].join("\n");
    assert.deepEqual(
        findViolations(src).map((v) => v.line),
        [1, 2]
    );
});

// ── what it leaves alone ────────────────────────────────────────────────────────

test("does not flag a require bound by createRequire", () => {
    const src = ['import { createRequire } from "node:module";', "const require = createRequire(import.meta.url);", "", "const pkg = require(\"./package.json\");", ""].join(
        "\n"
    );
    assert.equal(findViolations(src).length, 0);
});

test("does not flag a parameter named module", () => {
    const src = ["function wrap(module, exports) {", "    return module.exports || exports;", "}", ""].join("\n");
    assert.equal(findViolations(src).length, 0);
});

test("does not flag a local variable named module declared before use", () => {
    const src = ["function f() {", '    const module = { exports: {} };', "    return module.exports;", "}", ""].join("\n");
    assert.equal(findViolations(src).length, 0);
});

test("a var named require, hoisted from a nested block, is bound", () => {
    const src = ["function f(flag) {", "    if (flag) {", '        var require = () => "shim";', "    }", "    return require();", "}", ""].join("\n");
    assert.equal(findViolations(src).length, 0);
});

test("a property named require is not the global", () => {
    assert.equal(findViolations("const r = options.require;\n").length, 0);
});

test("require/module/exports inside a comment are not code", () => {
    assert.equal(findViolations("// module.exports and require() are CommonJS-only\nconst a = 1;\n").length, 0);
});

test("require/module/exports inside a string are not code", () => {
    assert.equal(findViolations('const s = "if (require.main === module)";\n').length, 0);
});

test("a type position is not a value use", () => {
    const src = ["type ModuleLike = { exports: unknown };", "declare const module: ModuleLike;", ""].join("\n");
    assert.equal(findViolations(src).length, 0);
});

// ── opting out ──────────────────────────────────────────────────────────────────

test("the marker exempts a use, and it is counted rather than hidden", () => {
    withTree(
        {
            "packages/p/package.json": JSON.stringify({ name: "p", type: "module", files: ["source"] }),
            "packages/p/source/a.ts": `if (require.main === module) { run(); } // ${IGNORE_MARKER} - deliberate\n`
        },
        (root) => {
            const result = analyze({ repoRoot: root });
            assert.equal(result.findings.length, 0);
            assert.equal(result.exempt, 2);
            assert.equal(exitCode(result), 0);
            assert.match(formatReport(result), /2 exempted/);
        }
    );
});

// ── file-level exclusions ───────────────────────────────────────────────────────

test(".cjs files are not scanned", () => {
    withTree(
        {
            "packages/p/package.json": JSON.stringify({ name: "p", type: "module", files: ["source"] }),
            "packages/p/source/a.cjs": "if (require.main === module) { run(); }\n"
        },
        (root) => {
            const result = analyze({ repoRoot: root });
            assert.equal(result.scanned, 0);
            assert.equal(result.findings.length, 0);
        }
    );
});

test(".mjs files are not scanned", () => {
    withTree(
        {
            "packages/p/package.json": JSON.stringify({ name: "p", type: "module", files: ["source"] }),
            "packages/p/source/a.mjs": "if (require.main === module) { run(); }\n"
        },
        (root) => {
            assert.equal(analyze({ repoRoot: root }).scanned, 0);
        }
    );
});

test("a nested package.json declaring commonjs breaks out of the module scope", () => {
    withTree(
        {
            "packages/p/package.json": JSON.stringify({ name: "p", type: "module", files: ["source"] }),
            "packages/p/source/generated/package.json": JSON.stringify({ type: "commonjs" }),
            "packages/p/source/generated/a.ts": "module.exports = {};\n"
        },
        (root) => {
            const result = analyze({ repoRoot: root });
            assert.equal(result.findings.length, 0);
        }
    );
});

test("nearestModuleType walks upward, not from the package root", () => {
    withTree(
        {
            "packages/p/package.json": JSON.stringify({ name: "p", type: "module" }),
            "packages/p/gen/package.json": JSON.stringify({ type: "commonjs" }),
            "packages/p/gen/deep/x.ts": "x;\n"
        },
        (root) => {
            assert.equal(nearestModuleType(path.join(root, "packages/p/gen/deep")), "commonjs");
            assert.equal(nearestModuleType(path.join(root, "packages/p")), "module");
        }
    );
});

// ── walking the tree ────────────────────────────────────────────────────────────

test("scans what each package publishes, not a hardcoded source/src", () => {
    withTree(
        {
            "packages/p/package.json": JSON.stringify({ name: "p", type: "module", files: ["api"] }),
            "packages/p/api/a.ts": "module.exports = {};\nexports.x = 1;\n"
        },
        (root) => {
            const result = analyze({ repoRoot: root });
            assert.equal(result.scanned, 1);
            assert.equal(result.findings.length, 2);
            assert.equal(exitCode(result), 1);
        }
    );
});

test("--scope source does not scan test trees", () => {
    withTree(
        {
            "packages/p/package.json": JSON.stringify({ name: "p", type: "module", files: ["source"] }),
            "packages/p/test/a.ts": "module.exports = {};\n"
        },
        (root) => {
            assert.equal(analyze({ repoRoot: root, scope: "source" }).findings.length, 0);
        }
    );
});

test("--scope all covers test trees too", () => {
    withTree(
        {
            "packages/p/package.json": JSON.stringify({ name: "p", type: "module", files: ["source"] }),
            "packages/p/test/a.ts": "module.exports = {};\n"
        },
        (root) => {
            const result = analyze({ repoRoot: root, scope: "all" });
            assert.equal(result.findings.length, 1);
        }
    );
});

test("--package narrows the scan", () => {
    withTree(
        {
            "packages/p/package.json": JSON.stringify({ name: "p", type: "module", files: ["source"] }),
            "packages/p/source/a.ts": "module.exports = {};\n",
            "packages/q/package.json": JSON.stringify({ name: "q", type: "module", files: ["source"] }),
            "packages/q/source/a.ts": "module.exports = {};\n"
        },
        (root) => {
            assert.equal(analyze({ repoRoot: root, packageFilter: "p" }).findings.length, 1);
        }
    );
});

// ── --fix ────────────────────────────────────────────────────────────────────────

test("--fix rewrites require.main === module and adds the import", () => {
    const src = ['import { promises as fs } from "node:fs";', "", "if (require.main === module) {", "    run();", "}", ""].join("\n");
    const { text, fixed } = fixText(src, "a.ts");
    assert.equal(fixed, 1);
    assert.equal(
        text,
        [
            'import { promises as fs } from "node:fs";',
            'import { pathToFileURL } from "node:url";',
            "",
            'if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {',
            "    run();",
            "}",
            ""
        ].join("\n")
    );
    // idempotent: running --fix again on the already-fixed text finds nothing left to do
    assert.equal(fixText(text, "a.ts").fixed, 0);
});

test("--fix handles the reversed spelling module === require.main", () => {
    const src = ["if (module === require.main) {", "    run();", "}", ""].join("\n");
    const { text, fixed } = fixText(src, "a.ts");
    assert.equal(fixed, 1);
    assert.match(text, /if \(import\.meta\.url === pathToFileURL\(process\.argv\[1\] \?\? ""\)\.href\) \{/);
    assert.match(text, /import \{ pathToFileURL \} from "node:url";/);
});

test("--fix does not add a duplicate import when node:url is already imported", () => {
    const src = ['import { pathToFileURL } from "node:url";', "", "if (require.main === module) {", "    run();", "}", ""].join("\n");
    const { text, fixed } = fixText(src, "a.ts");
    assert.equal(fixed, 1);
    assert.equal((text.match(/from "node:url"/g) ?? []).length, 1);
});

test("--fix leaves everything else alone", () => {
    const src = "module.exports = {};\nconsole.log(require);\n";
    const { text, fixed } = fixText(src, "a.ts");
    assert.equal(fixed, 0);
    assert.equal(text, src);
});
