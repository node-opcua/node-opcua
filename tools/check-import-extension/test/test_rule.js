/**
 * Unit tests for the import-extension rule.
 *
 * The cases that matter most are the ones where a naive fixer gets it wrong: a directory
 * import (which needs /index.js, not .js), and a module specifier appearing inside a
 * generated-code template literal (which must never be rewritten, because this repo has
 * code generators whose output contains import statements).
 *
 * Run: node test/test_rule.js
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
    findViolations,
    fixText,
    resolveSpecifier,
    analyze,
    exitCode,
    formatReport,
    isGating,
    PACKAGE_ROOT_BLOCKED,
    IGNORE_MARKER
} from "../src/rule.js";

function withTree(files, fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-import-ext-"));
    try {
        for (const [rel, content] of Object.entries(files)) {
            const full = path.join(root, rel);
            fs.mkdirSync(path.dirname(full), { recursive: true });
            fs.writeFileSync(full, content);
        }
        return fn(root.replace(/\\/g, "/"));
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

// --- resolution: file vs directory ------------------------------------------------

test("a sibling file becomes .js", () => {
    withTree({ "a/b.ts": "", "a/c.ts": "" }, (root) => {
        assert.deepEqual(resolveSpecifier(`${root}/a/b.ts`, "./c"), { kind: "file", suggestion: "./c.js" });
    });
});

test("a directory becomes /index.js, not .js", () => {
    withTree({ "a/b.ts": "", "a/private/index.ts": "" }, (root) => {
        assert.deepEqual(resolveSpecifier(`${root}/a/b.ts`, "./private"), { kind: "directory", suggestion: "./private/index.js" });
    });
});

test("a trailing slash on a directory does not double up", () => {
    withTree({ "a/b.ts": "", "a/private/index.ts": "" }, (root) => {
        assert.equal(resolveSpecifier(`${root}/a/b.ts`, "./private/").suggestion, "./private/index.js");
    });
});

test("a parent-relative specifier resolves", () => {
    withTree({ "a/deep/b.ts": "", "a/shared.ts": "" }, (root) => {
        assert.equal(resolveSpecifier(`${root}/a/deep/b.ts`, "../shared").suggestion, "../shared.js");
    });
});

test("a file wins over a same-named directory", () => {
    withTree({ "a/b.ts": "", "a/thing.ts": "", "a/thing/index.ts": "" }, (root) => {
        assert.equal(resolveSpecifier(`${root}/a/b.ts`, "./thing").kind, "file");
    });
});

test("nothing on disk is unresolved, never guessed", () => {
    withTree({ "a/b.ts": "" }, (root) => {
        assert.deepEqual(resolveSpecifier(`${root}/a/b.ts`, "./missing"), { kind: "unresolved", suggestion: null });
    });
});

// --- what is flagged ---------------------------------------------------------------

test("flags import, export-from, export-star and dynamic import", () => {
    withTree({ "a/b.ts": "", "a/c.ts": "", "a/d.ts": "", "a/e.ts": "", "a/f.ts": "" }, (root) => {
        const src = `
import { x } from "./c";
export { y } from "./d";
export * from "./e";
const lazy = () => import("./f");
`;
        const found = findViolations(src, `${root}/a/b.ts`);
        assert.equal(found.length, 4, JSON.stringify(found));
        assert.ok(found.every((f) => f.fixable));
    });
});

test("flags a type-only import too, so the tree is uniform", () => {
    withTree({ "a/b.ts": "", "a/c.ts": "" }, (root) => {
        assert.equal(findViolations('import type { T } from "./c";\n', `${root}/a/b.ts`).length, 1);
    });
});

// --- what is not flagged -----------------------------------------------------------

test("a bare package specifier is not our business", () => {
    withTree({ "a/b.ts": "" }, (root) => {
        assert.deepEqual(findViolations('import x from "node-opcua-utils";\nimport y from "node:path";\n', `${root}/a/b.ts`), []);
    });
});

test("an already-settled extension is left alone", () => {
    withTree({ "a/b.ts": "", "a/c.ts": "" }, (root) => {
        const src = 'import a from "./c.js";\nimport b from "./x.json";\nimport c from "./y.mjs";\n';
        assert.deepEqual(findViolations(src, `${root}/a/b.ts`), []);
    });
});

test("a specifier inside a generated-code template literal is NOT a specifier", () => {
    withTree({ "a/b.ts": "", "a/c.ts": "" }, (root) => {
        // this is what the nodeset-to-typescript generators emit; a regex-based tool
        // would rewrite the template and corrupt the generated output
        const src = "const code = `import { X } from \"./${filename}\";`;\nwrite(`export * from \"./types\";`);\n";
        assert.deepEqual(findViolations(src, `${root}/a/b.ts`), []);
        assert.equal(fixText(src, `${root}/a/b.ts`).fixed, 0);
    });
});

test("an ignore marker opts one line out", () => {
    withTree({ "a/b.ts": "", "a/c.ts": "" }, (root) => {
        const src = `import x from "./c"; // ${IGNORE_MARKER} - deliberate\n`;
        assert.deepEqual(findViolations(src, `${root}/a/b.ts`), []);
    });
});

// --- fixing ------------------------------------------------------------------------

test("fix rewrites files and directories differently, and preserves the quote style", () => {
    withTree({ "a/b.ts": "", "a/c.ts": "", "a/private/index.ts": "" }, (root) => {
        const src = `import x from "./c";\nimport y from './private';\n`;
        const { text, fixed } = fixText(src, `${root}/a/b.ts`);
        assert.equal(fixed, 2);
        assert.match(text, /from "\.\/c\.js"/);
        assert.match(text, /from '\.\/private\/index\.js'/);
    });
});

test("fix is idempotent", () => {
    withTree({ "a/b.ts": "", "a/c.ts": "" }, (root) => {
        const once = fixText('import x from "./c";\n', `${root}/a/b.ts`);
        const twice = fixText(once.text, `${root}/a/b.ts`);
        assert.equal(twice.fixed, 0);
        assert.equal(twice.text, once.text);
    });
});

test("fix never rewrites an unresolvable specifier", () => {
    withTree({ "a/b.ts": "" }, (root) => {
        const src = 'import x from "./missing";\n';
        const { text, fixed } = fixText(src, `${root}/a/b.ts`);
        assert.equal(fixed, 0);
        assert.equal(text, src);
    });
});

test("multiple specifiers on one line are all rewritten correctly", () => {
    withTree({ "a/b.ts": "", "a/c.ts": "", "a/d.ts": "" }, (root) => {
        const src = 'import x from "./c"; import y from "./d";\n';
        const { text, fixed } = fixText(src, `${root}/a/b.ts`);
        assert.equal(fixed, 2);
        assert.match(text, /"\.\/c\.js".*"\.\/d\.js"/);
    });
});

// --- tree walking -------------------------------------------------------------------

test("scans source and src, skipping tests, dist and .d.ts", () => {
    withTree(
        {
            "packages/p/source/a.ts": 'import x from "./b";\n',
            "packages/p/source/b.ts": "",
            "packages/q/src/a.ts": 'import x from "./b";\n',
            "packages/q/src/b.ts": "",
            "packages/r/test/a.ts": 'import x from "./b";\n',
            "packages/r/test/b.ts": "",
            "packages/s/source/a.d.ts": 'import x from "./b";\n'
        },
        (root) => {
            const result = analyze({ repoRoot: root });
            assert.equal(result.findings.length, 2, JSON.stringify(result.findings));
            assert.equal(exitCode(result), 1);
        }
    );
});

test("write mode fixes and then reports clean", () => {
    withTree({ "packages/p/source/a.ts": 'import x from "./b";\n', "packages/p/source/b.ts": "" }, (root) => {
        const result = analyze({ repoRoot: root, write: true });
        assert.equal(result.fixedCount, 1);
        assert.equal(result.findings.length, 0);
        assert.equal(exitCode(result), 0);
        assert.match(fs.readFileSync(path.join(root, "packages/p/source/a.ts"), "utf8"), /"\.\/b\.js"/);
        assert.match(formatReport(result), /rewrote 1 specifiers/);
    });
});

test("--package narrows the scan", () => {
    withTree(
        {
            "packages/p/source/a.ts": 'import x from "./b";\n',
            "packages/p/source/b.ts": "",
            "packages/q/source/a.ts": 'import x from "./b";\n',
            "packages/q/source/b.ts": ""
        },
        (root) => {
            const result = analyze({ repoRoot: root, packageFilter: "p" });
            assert.equal(result.findings.length, 1);
        }
    );
});


// ── scope: test trees ───────────────────────────────────────────────────────────
//
// A test tree is not published, but a file inside a `"type": "module"` package is an ES
// module whether it ships or not, so a package that flips breaks its own suite.

test("the default scope leaves test trees alone", () => {
    withTree({ "packages/p/test/a.ts": 'import x from "./b";\n', "packages/p/test/b.ts": "" }, (root) => {
        const result = analyze({ repoRoot: root });
        assert.equal(result.scanned, 0);
        assert.equal(result.findings.length, 0);
    });
});

test("--scope tests covers test, test_helpers and test_fixtures", () => {
    withTree(
        {
            "packages/p/source/a.ts": 'import x from "./b";\n',
            "packages/p/source/b.ts": "",
            "packages/p/test/c.ts": 'import x from "./d";\n',
            "packages/p/test/d.ts": "",
            "packages/p/test_helpers/e.ts": 'import x from "./f";\n',
            "packages/p/test_helpers/f.ts": "",
            "packages/p/test_fixtures/g.ts": 'import x from "./h";\n',
            "packages/p/test_fixtures/h.ts": ""
        },
        (root) => {
            const result = analyze({ repoRoot: root, scope: "tests" });
            assert.equal(result.findings.length, 3, JSON.stringify(result.findings));
            assert.equal(analyze({ repoRoot: root, scope: "all" }).findings.length, 4);
        }
    );
});

test("--scope tests fixes the same way as source", () => {
    withTree({ "packages/p/test/a.ts": 'import x from "./b";\n', "packages/p/test/b.ts": "" }, (root) => {
        const result = analyze({ repoRoot: root, scope: "tests", write: true });
        assert.equal(result.fixedCount, 1);
        assert.equal(exitCode(result), 0);
        assert.match(fs.readFileSync(path.join(root, "packages/p/test/a.ts"), "utf8"), /"\.\/b\.js"/);
    });
});

// ── package-root specifiers ─────────────────────────────────────────────────────

test('".", ".." and "../.." are reported as package-root, not as unresolvable', () => {
    withTree(
        {
            "packages/p/test/a.ts": 'import x from "..";\nimport y from ".";\n',
            "packages/p/test/deep/b.ts": 'import z from "../..";\n'
        },
        (root) => {
            const result = analyze({ repoRoot: root, scope: "tests" });
            assert.equal(result.findings.length, 3, JSON.stringify(result.findings));
            for (const f of result.findings) {
                assert.equal(f.kind, "package-root");
                assert.equal(f.fixable, false);
                assert.equal(f.suggestion, null);
            }
        }
    );
});

test("a package-root specifier fails the gate, and the report says what to name instead", () => {
    withTree({ "packages/p/test/a.ts": 'import x from "..";\n' }, (root) => {
        const result = analyze({ repoRoot: root, scope: "tests" });
        assert.equal(exitCode(result), 1, "a directory specifier does not resolve under ESM");
        const report = formatReport(result);
        assert.match(report, /1 import\(s\) of "\." or "\.\."/);
        assert.match(report, /Name the entry point that package\.json already names/);
        // it has no suggestion, so it must not be counted among the manual ones as well
        assert.doesNotMatch(report, /could not be resolved on disk/);
    });
});

test("nothing is exempt", () => {
    // node-opcua-address-space was, while its main and types named different modules. That is
    // fixed, and check-entry-points now fails any package that splits them, so an entry here
    // should stay an anomaly rather than a habit.
    assert.equal(PACKAGE_ROOT_BLOCKED.size, 0);
});

test("the exemption mechanism still works, for whenever it is needed again", () => {
    const blockedPkg = "packages/node-opcua-hypothetical";
    PACKAGE_ROOT_BLOCKED.set(blockedPkg, "a reason, which the report prints");
    try {
        const rootFinding = (file) => ({ file, kind: "package-root", line: 1, specifier: "..", fixable: false });

        assert.equal(isGating(rootFinding(`${blockedPkg}/test/a.ts`)), false);
        assert.equal(isGating(rootFinding("packages/node-opcua-other/test/a.ts")), true);
        // the exemption is for package-root only; a missing extension there still fails
        assert.equal(isGating({ file: `${blockedPkg}/test/a.ts`, kind: "file", fixable: true }), true);

        // an exempt package is still reported, or the gate reads as if it had covered it
        const report = formatReport({ scanned: 1, findings: [rootFinding(`${blockedPkg}/test/a.ts`)], scope: "all" });
        assert.match(report, new RegExp(`1 import\\(s\\) of "\\." or "\\.\\." remain in ${blockedPkg}`));
        assert.match(report, /a reason, which the report prints/);
    } finally {
        PACKAGE_ROOT_BLOCKED.delete(blockedPkg);
    }
});

test("a package-root specifier is never rewritten", () => {
    withTree({ "packages/p/test/a.ts": 'import x from "..";\n' }, (root) => {
        const result = analyze({ repoRoot: root, scope: "tests", write: true });
        assert.equal(result.fixedCount, 0);
        assert.equal(fs.readFileSync(path.join(root, "packages/p/test/a.ts"), "utf8"), 'import x from "..";\n');
    });
});

test("the report always names the scope it covered", () => {
    withTree({ "packages/p/source/a.ts": 'import x from "./b.js";\n', "packages/p/source/b.ts": "" }, (root) => {
        assert.match(formatReport(analyze({ repoRoot: root })), /source files scanned/);
        assert.match(formatReport(analyze({ repoRoot: root, scope: "tests" })), /test files scanned/);
    });
});

// ── the scanned set follows what a package publishes ────────────────────────────
//
// These pin the regression that motivated the change: the gate scanned a hardcoded
// `source`/`src`, so a package shipping anything else left its coverage silently, and the
// report still said "clean" because nothing had been looked at.

test("scans a source directory a package names in `files`, whatever it is called", () => {
    withTree(
        {
            "packages/p/package.json": JSON.stringify({ name: "p", files: ["api", "impl", "dist"] }),
            "packages/p/api/a.ts": 'import x from "./b";\n',
            "packages/p/api/b.ts": "",
            "packages/p/impl/c.ts": 'import x from "./d";\n',
            "packages/p/impl/d.ts": ""
        },
        (root) => {
            const result = analyze({ repoRoot: root });
            assert.equal(result.scanned, 4);
            assert.equal(result.findings.length, 2, JSON.stringify(result.findings));
        }
    );
});

test("scans a shipped directory alongside the conventional ones", () => {
    withTree(
        {
            "packages/p/package.json": JSON.stringify({ name: "p", files: ["source", "source_nodejs"] }),
            "packages/p/source/a.ts": 'import x from "./b";\n',
            "packages/p/source/b.ts": "",
            "packages/p/source_nodejs/c.ts": 'import x from "./d";\n',
            "packages/p/source_nodejs/d.ts": ""
        },
        (root) => {
            assert.equal(analyze({ repoRoot: root }).findings.length, 2);
        }
    );
});

test("build output is never scanned, even when `files` names it", () => {
    withTree(
        {
            "packages/p/package.json": JSON.stringify({ name: "p", files: ["dist", "source"] }),
            "packages/p/dist/a.ts": 'import x from "./b";\n',
            "packages/p/dist/b.ts": "",
            "packages/p/source/c.ts": ""
        },
        (root) => {
            const result = analyze({ repoRoot: root });
            assert.equal(result.scanned, 1);
            assert.equal(result.findings.length, 0);
        }
    );
});

test("a package with no manifest still gets its conventional layout scanned", () => {
    withTree({ "packages/p/source/a.ts": 'import x from "./b";\n', "packages/p/source/b.ts": "" }, (root) => {
        // guessing wide is recoverable; scanning nothing and reporting clean is not
        assert.equal(analyze({ repoRoot: root }).findings.length, 1);
    });
});
