/**
 * Unit tests for the debug-logger naming rule.
 *
 * The fixtures are the shapes this repo actually contained before the codemod, including
 * the two that were passing __dirname to a parameter named scriptFullPath, and the
 * declarations inside node-opcua-debug itself, which must never be rewritten.
 *
 * Run: node test/test_rule.js
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { findViolations, fixText, moduleNameFor, analyze, exitCode, formatReport, IGNORE_MARKER } from "../src/rule.js";

// --- the name derived for a file ------------------------------------------------

test("module name strips directory and extension, and is idempotent", () => {
    assert.equal(moduleNameFor("packages/node-opcua-client/source/client_session.ts"), "client_session");
    assert.equal(moduleNameFor("C:\\repo\\packages\\p\\source\\a.js"), "a");
    assert.equal(moduleNameFor("client_session"), "client_session");
    // only a trailing .js/.ts is removed, matching extractBasename
    assert.equal(moduleNameFor("packages/p/source/index.browser.ts"), "index.browser");
});

// --- flagged ---------------------------------------------------------------------

test("flags every factory called with __filename", () => {
    const source = `
const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
const errorLog = make_errorLog(__filename);
const warningLog = make_warningLog(__filename);
const traceLog = make_traceLog(__filename);
`;
    const found = findViolations(source, "packages/p/source/thing.ts");
    assert.equal(found.length, 5);
    assert.ok(found.every((f) => f.fixable));
    assert.ok(found.every((f) => f.suggestion === "thing"));
});

test("flags __dirname too, which is how two sites got a directory as their debug key", () => {
    const found = findViolations("const debugLog = make_debugLog(__dirname);\n", "packages/p/source/loader/variant_parser.ts");
    assert.equal(found.length, 1);
    assert.equal(found[0].arg, "__dirname");
    assert.equal(found[0].suggestion, "variant_parser");
});

test("tolerates whitespace inside the call", () => {
    assert.equal(findViolations("make_debugLog( __filename );\n", "packages/p/source/a.ts").length, 1);
});

test("reports a non-literal argument but marks it not fixable", () => {
    const found = findViolations("const debugLog = make_debugLog(someName);\n", "packages/p/source/a.ts");
    assert.equal(found.length, 1);
    assert.equal(found[0].fixable, false);
});

// --- not flagged -----------------------------------------------------------------

test("a string literal is the goal state", () => {
    assert.deepEqual(findViolations('const debugLog = make_debugLog("client_session");\n', "packages/p/source/a.ts"), []);
    assert.deepEqual(findViolations("const debugLog = make_debugLog('a');\n", "packages/p/source/a.ts"), []);
});

test("the declarations in node-opcua-debug are not call sites", () => {
    const source = `
export function make_debugLog(scriptFullPath: string): (...arg: unknown[]) => void {
    const filename = extractBasename(scriptFullPath);
}
export function checkDebugFlag(scriptFullPath: string): boolean {}
export function make_errorLog(_context: string): PrintFunc {}
`;
    assert.deepEqual(findViolations(source, "packages/node-opcua-debug/source/make_loggers.ts"), []);
});

test("an ignore marker opts one line out", () => {
    const source = `const x = setDebugFlag(filename, doDebug); // ${IGNORE_MARKER} - internal to the helper\n`;
    assert.deepEqual(findViolations(source, "packages/node-opcua-debug/source/make_loggers.ts"), []);
});

test("a bare __filename unrelated to the loggers is not this rule's business", () => {
    const source = 'const p = path.join(__dirname, "../nodesets");\nconst f = __filename;\n';
    assert.deepEqual(findViolations(source, "packages/p/source/a.ts"), []);
});

// --- fixing ----------------------------------------------------------------------

test("fix rewrites to the module name and leaves everything else alone", () => {
    const before = `import { make_debugLog } from "node-opcua-debug";
const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
const p = path.join(__dirname, "..");
`;
    const { text, fixed } = fixText(before, "packages/p/source/client_session.ts");
    assert.equal(fixed, 2);
    assert.match(text, /make_debugLog\("client_session"\)/);
    assert.match(text, /checkDebugFlag\("client_session"\)/);
    // the genuine path use is untouched
    assert.match(text, /path\.join\(__dirname, "\.\."\)/);
});

test("fix is idempotent", () => {
    const once = fixText("const d = make_debugLog(__filename);\n", "packages/p/source/a.ts");
    const twice = fixText(once.text, "packages/p/source/a.ts");
    assert.equal(twice.fixed, 0);
    assert.equal(twice.text, once.text);
});

test("fix never rewrites a declaration or an ignored line", () => {
    const before = `export function make_debugLog(scriptFullPath: string) {}
const x = make_debugLog(__filename); // ${IGNORE_MARKER} - deliberate
`;
    const { text, fixed } = fixText(before, "packages/node-opcua-debug/source/make_loggers.ts");
    assert.equal(fixed, 0);
    assert.equal(text, before);
});

test("fix does not touch a non-literal it cannot reason about", () => {
    const before = "const d = make_debugLog(computeName());\n";
    const { text, fixed } = fixText(before, "packages/p/source/a.ts");
    assert.equal(fixed, 0);
    assert.equal(text, before);
});

// --- tree walking ----------------------------------------------------------------

function withTree(files, fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-debug-name-"));
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

test("scans packages and packages_extra, skipping tests and dist", () => {
    withTree(
        {
            "packages/a/source/one.ts": "const d = make_debugLog(__filename);\n",
            "packages_extra/b/src/two.ts": "const d = make_debugLog(__filename);\n",
            "packages/c/test/three.ts": "const d = make_debugLog(__filename);\n",
            "packages/d/dist/four.js": "const d = make_debugLog(__filename);\n"
        },
        (root) => {
            const result = analyze({ repoRoot: root });
            assert.equal(result.findings.length, 2, JSON.stringify(result.findings, null, 2));
            assert.equal(exitCode(result), 1);
            assert.ok(result.findings.some((f) => f.file.endsWith("packages/a/source/one.ts")));
            assert.ok(result.findings.some((f) => f.file.endsWith("packages_extra/b/src/two.ts")));
        }
    );
});

test("--package narrows the scan", () => {
    withTree(
        {
            "packages/a/source/one.ts": "const d = make_debugLog(__filename);\n",
            "packages/b/source/two.ts": "const d = make_debugLog(__filename);\n"
        },
        (root) => {
            const result = analyze({ repoRoot: root, packageFilter: "a" });
            assert.equal(result.findings.length, 1);
            assert.ok(result.findings[0].file.endsWith("packages/a/source/one.ts"));
        }
    );
});

test("write mode fixes the tree and then reports clean", () => {
    withTree({ "packages/a/source/one.ts": "const d = make_debugLog(__filename);\n" }, (root) => {
        const result = analyze({ repoRoot: root, write: true });
        assert.equal(result.fixedCount, 1);
        assert.equal(result.findings.length, 0);
        assert.equal(exitCode(result), 0);
        assert.match(fs.readFileSync(path.join(root, "packages/a/source/one.ts"), "utf8"), /make_debugLog\("one"\)/);
        assert.match(formatReport(result), /rewrote 1 call sites/);
    });
});

test("a clean tree reports clean and exits 0", () => {
    withTree({ "packages/a/source/one.ts": 'const d = make_debugLog("one");\n' }, (root) => {
        const result = analyze({ repoRoot: root });
        assert.equal(exitCode(result), 0);
        assert.match(formatReport(result), /every logger takes a module name/);
    });
});
