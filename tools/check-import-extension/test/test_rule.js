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

import { findViolations, fixText, resolveSpecifier, analyze, exitCode, formatReport, IGNORE_MARKER } from "../src/rule.js";

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
