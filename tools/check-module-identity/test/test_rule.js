/**
 * Unit tests for the module-identity rule.
 *
 * The cases that matter are the ones where a naive rule gets it wrong: a deep import into
 * dist is the SAME instance and must not be flagged, `import type` is erased and cannot
 * duplicate anything, and the sibling build outputs (distNodeJS, distHelpers) re-export
 * dist rather than recompiling it.
 *
 * Run: node test/test_rule.js
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { analyze, classify, exitCode, findViolations, formatReport, IGNORE_MARKER, valueSpecifiers } from "../src/rule.js";

function withTree(files, fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-module-identity-"));
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

// ── the hazard ──────────────────────────────────────────────────────────────────

test("own package reached as both built output and source is a violation", () => {
    const text = 'import { A } from "..";\nimport { B } from "../source/b.js";\n';
    const found = findViolations(text, "test/x.ts", "node-opcua-foo");
    assert.equal(found.length, 1);
    assert.equal(found[0].pkg, "node-opcua-foo");
    assert.deepEqual(found[0].built, [".."]);
    assert.deepEqual(found[0].source, ["../source/b.js"]);
});

test("src/ and source_nodejs/ count as source too", () => {
    for (const dir of ["src", "source_nodejs"]) {
        const text = `import { A } from "..";\nimport { B } from "../${dir}/b.js";\n`;
        assert.equal(findViolations(text, "test/x.ts", "p").length, 1, dir);
    }
});

test("another package reached by name and through its source tree", () => {
    const text = 'import { A } from "node-opcua-foo";\nimport { B } from "node-opcua-foo/source/b.js";\n';
    const found = findViolations(text, "test/x.ts", "node-opcua-bar");
    assert.equal(found.length, 1);
    assert.equal(found[0].pkg, "node-opcua-foo");
});

test("a nested test file resolves its package root correctly", () => {
    const text = 'import { A } from "../..";\nimport { B } from "../../source/b.js";\n';
    assert.equal(findViolations(text, "test/deep/x.ts", "p").length, 1);
});

// ── what must NOT be flagged ────────────────────────────────────────────────────

test("a deep import into dist is the same instance", () => {
    const text = 'import { A } from "..";\nimport { B } from "../dist/private/b.js";\n';
    assert.equal(findViolations(text, "test/x.ts", "p").length, 0);
});

test("distNodeJS and distHelpers re-export dist and are not a second copy", () => {
    for (const dir of ["distNodeJS", "distHelpers"]) {
        const text = `import { A } from "..";\nimport { B } from "../${dir}/index.js";\n`;
        assert.equal(findViolations(text, "test/x.ts", "p").length, 0, dir);
    }
});

test("import type is erased and cannot duplicate a module", () => {
    const text = 'import { A } from "..";\nimport type { B } from "../source/b.js";\n';
    assert.equal(findViolations(text, "test/x.ts", "p").length, 0);
});

test("a clause of only inline type specifiers is erased as well", () => {
    const text = 'import { A } from "..";\nimport { type B, type C } from "../source/b.js";\n';
    assert.equal(findViolations(text, "test/x.ts", "p").length, 0);
});

test("one route alone is fine, whichever it is", () => {
    assert.equal(findViolations('import { B } from "../source/b.js";\n', "test/x.ts", "p").length, 0);
    assert.equal(findViolations('import { A } from "..";\n', "test/x.ts", "p").length, 0);
});

test("two different packages do not combine into a violation", () => {
    const text = 'import { A } from "node-opcua-foo";\nimport { B } from "node-opcua-bar/source/b.js";\n';
    assert.equal(findViolations(text, "test/x.ts", "p").length, 0);
});

test("a subpath export resolves into the built tree", () => {
    const text = 'import { A } from "node-opcua-foo";\nimport { B } from "node-opcua-foo/testHelpers";\n';
    assert.equal(findViolations(text, "test/x.ts", "p").length, 0);
});

test("the ignore marker opts a line out", () => {
    const text = `import { A } from "..";\nimport { B } from "../source/b.js"; // ${IGNORE_MARKER} - deliberate\n`;
    assert.equal(findViolations(text, "test/x.ts", "p").length, 0);
});

// ── helpers ─────────────────────────────────────────────────────────────────────

test("valueSpecifiers skips type-only imports and keeps side-effect ones", () => {
    const text = ['import type { A } from "a";', 'import { B } from "b";', 'import "c";', 'import D from "d";'].join("\n");
    assert.deepEqual(valueSpecifiers(text).sort(), ["b", "c", "d"]);
});

test("classify tells the two routes apart", () => {
    assert.deepEqual(classify("..", "test/x.ts", "p"), { pkg: "p", route: "built" });
    assert.deepEqual(classify("../source/a.js", "test/x.ts", "p"), { pkg: "p", route: "source" });
    assert.deepEqual(classify("../dist/a.js", "test/x.ts", "p"), { pkg: "p", route: "built" });
    assert.deepEqual(classify("node-opcua-foo", "test/x.ts", "p"), { pkg: "node-opcua-foo", route: "built" });
    assert.deepEqual(classify("node-opcua-foo/src/a.js", "test/x.ts", "p"), { pkg: "node-opcua-foo", route: "source" });
    assert.equal(classify("./sibling.js", "test/x.ts", "p"), null);
});

// ── end to end ──────────────────────────────────────────────────────────────────

test("analyze walks the packages and the report explains the consequence", () => {
    withTree(
        {
            "packages/p/test/bad.ts": 'import { A } from "..";\nimport { B } from "../source/b.js";\n',
            "packages/p/test/good.ts": 'import { A } from "..";\nimport { B } from "../dist/b.js";\n',
            "packages/p/source/b.ts": ""
        },
        (root) => {
            const result = analyze({ repoRoot: root });
            assert.equal(result.findings.length, 1);
            assert.match(result.findings[0].file, /bad\.ts$/);
            assert.equal(exitCode(result), 1);
            const report = formatReport(result);
            assert.match(report, /reaches p twice/);
            assert.match(report, /instanceof across the boundary is false/);
        }
    );
});

test("a clean tree reports the count it scanned", () => {
    withTree({ "packages/p/test/ok.ts": 'import { A } from "..";\n' }, (root) => {
        const result = analyze({ repoRoot: root });
        assert.equal(exitCode(result), 0);
        assert.match(formatReport(result), /1 files scanned, every package is reached by a single route/);
    });
});
