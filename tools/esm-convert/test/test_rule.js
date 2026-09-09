/**
 * Tests for esm-convert.
 *
 * The tool writes to source, so most of these pin what it must refuse. A converter that
 * guesses at the half needing judgement is worse than no converter: the guesses compile and
 * change behaviour.
 */
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyze, convertAnchors, convertMocharc, findManualWork, setTypeModule, survey } from "../src/rule.js";

function withTree(files, fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "esm-convert-"));
    try {
        for (const [rel, contents] of Object.entries(files)) {
            const full = path.join(root, rel);
            fs.mkdirSync(path.dirname(full), { recursive: true });
            fs.writeFileSync(full, typeof contents === "string" ? contents : JSON.stringify(contents, null, 4));
        }
        fn(root);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

// ── the type field ──────────────────────────────────────────────────────────────

test("adds the type field after name, keeping the rest of the manifest", () => {
    const text = '{\n    "name": "p",\n    "main": "dist/index.js"\n}\n';
    const out = setTypeModule(text);
    assert.equal(JSON.parse(out).type, "module");
    assert.equal(JSON.parse(out).main, "dist/index.js");
    assert.equal(out.split("\n").length, text.split("\n").length + 1);
});

test("returns null when the package is already ESM, so nothing is rewritten", () => {
    assert.equal(setTypeModule('{\n    "name": "p",\n    "type": "module"\n}\n'), null);
});

test("replaces an explicit commonjs type rather than adding a second key", () => {
    const out = setTypeModule('{\n    "name": "p",\n    "type": "commonjs"\n}\n');
    assert.equal(JSON.parse(out).type, "module");
    assert.equal((out.match(/"type"/g) ?? []).length, 1);
});

// ── the mocha config ────────────────────────────────────────────────────────────

test("converts module.exports to export default", () => {
    const out = convertMocharc("module.exports = {\n    timeout: 100\n};\n");
    assert.match(out, /export default \{/);
    assert.doesNotMatch(out, /module\.exports/);
});

test("adds createRequire only when the config actually uses require", () => {
    const withReq = convertMocharc('module.exports = { ...require("../.mocharc.js") };\n');
    assert.match(withReq, /createRequire\(import\.meta\.url\)/);

    const without = convertMocharc("module.exports = { timeout: 100 };\n");
    assert.doesNotMatch(without, /createRequire/);
});

test("the converted config still parses as a module and keeps its settings", () => {
    const out = convertMocharc('const resolve = (id) => require.resolve(id);\nmodule.exports = {\n    timeout: 30000\n};\n');
    assert.match(out, /export default/);
    assert.match(out, /createRequire/);
    assert.match(out, /timeout: 30000/);
});

test("refuses a config using __dirname, rather than half-converting it", () => {
    assert.equal(convertMocharc('module.exports = { spec: __dirname + "/test" };\n'), null);
});

test("refuses a config using exports.foo", () => {
    assert.equal(convertMocharc("exports.timeout = 100;\nmodule.exports = {};\n"), null);
});

test("returns null for a config that is already ESM", () => {
    assert.equal(convertMocharc("export default { timeout: 100 };\n"), null);
});

// ── the dirname anchor ──────────────────────────────────────────────────────────

test("converts the anchor and drops the note that says it cannot be used", () => {
    const text = [
        "// The one place this module learns where it sits on disk. `import.meta.dirname`",
        "// cannot be used while this package emits CommonJS (TS1470), so the ESM migration",
        "// has this single line to change rather than several scattered uses.",
        "const here = __dirname;",
        ""
    ].join("\n");
    const out = convertAnchors(text);
    assert.equal(out, "const here = import.meta.dirname;\n");
});

test("converts a __filename anchor to import.meta.filename", () => {
    assert.equal(convertAnchors("const self = __filename;\n"), "const self = import.meta.filename;\n");
});

test("converts an exported anchor", () => {
    assert.equal(convertAnchors("export const here = __dirname;\n"), "export const here = import.meta.dirname;\n");
});

test("leaves a scattered use alone: only the anchor shape is mechanical", () => {
    // check-dirname keeps these out of shipped source; if one appears, a person decides
    assert.equal(convertAnchors('const p = path.join(__dirname, "x");\n'), null);
});

// ── what needs a person ─────────────────────────────────────────────────────────

test("reports a require of a module, because dynamic import is async", () => {
    const found = findManualWork('const { x } = require("./thing");\n');
    assert.equal(found[0].kind, "require-module");
});

test("reports a require of package.json separately: it has its own options", () => {
    const found = findManualWork('const info = require("../package.json");\n');
    assert.equal(found[0].kind, "require-json");
});

test("reports a non-literal require, which is deliberate", () => {
    const found = findManualWork("const usage = require(usageModule);\n");
    assert.equal(found[0].kind, "require-dynamic");
});

test("reports module-scope await, which breaks require(esm) downstream", () => {
    const found = findManualWork("const x = await load();\n");
    assert.equal(found[0].kind, "top-level-await");
});

test("await inside a function is fine and is not reported", () => {
    assert.equal(findManualWork("async function f() {\n    return await load();\n}\n").length, 0);
});

test("require in a comment is not code", () => {
    assert.equal(findManualWork('// const x = require("y");\nconst a = 1;\n').length, 0);
});

test("an ordinary import is not manual work", () => {
    assert.equal(findManualWork('import { x } from "./thing.js";\n').length, 0);
});

// ── the whole package ───────────────────────────────────────────────────────────

test("analyze reports what is mechanical and what is not", () => {
    withTree(
        {
            "packages/p/package.json": JSON.stringify({ name: "p", files: ["source"] }),
            "packages/p/.mocharc.js": 'module.exports = { ...require("../.mocharc.js") };\n',
            "packages/p/source/a.ts": "const here = __dirname;\n",
            "packages/p/source/b.ts": 'const info = require("../package.json");\n'
        },
        (root) => {
            const r = analyze({ repoRoot: root, packageName: "p" });
            assert.equal(r.found, true);
            assert.equal(r.alreadyEsm, false);
            assert.equal(r.mocharc, "convertible");
            assert.equal(r.anchors.length, 1);
            assert.equal(r.manual.length, 1);
            assert.equal(r.manual[0].kind, "require-json");
        }
    );
});

test("an unrecognised mocha config is flagged, not rewritten", () => {
    withTree(
        {
            "packages/p/package.json": JSON.stringify({ name: "p" }),
            "packages/p/.mocharc.js": "module.exports = { spec: __dirname };\n"
        },
        (root) => {
            assert.equal(analyze({ repoRoot: root, packageName: "p" }).mocharc, "unrecognised");
        }
    );
});

test("a package that does not exist is reported rather than throwing", () => {
    withTree({ "packages/p/package.json": JSON.stringify({ name: "p" }) }, (root) => {
        assert.equal(analyze({ repoRoot: root, packageName: "nope" }).found, false);
    });
});

test("test trees are converted too: they become ESM with the package", () => {
    withTree(
        {
            "packages/p/package.json": JSON.stringify({ name: "p", files: ["source"] }),
            "packages/p/source/a.ts": "export const x = 1;\n",
            "packages/p/test/t.ts": "const here = __dirname;\n"
        },
        (root) => {
            assert.equal(analyze({ repoRoot: root, packageName: "p" }).anchors.length, 1);
        }
    );
});

// ── the workspace survey ────────────────────────────────────────────────────────
//
// The number this produces is what FEAT-2 is planned against, so it is worth pinning that
// it counts packages rather than directory entries. Counting `ls packages` gave 134 once,
// because packages/ also holds parallel_test.js, tsconfig.json and six other loose files.

test("counts only directories carrying a package.json", () => {
    withTree(
        {
            "packages/a/package.json": JSON.stringify({ name: "a" }),
            "packages/b/package.json": JSON.stringify({ name: "b" }),
            "packages/tsconfig.json": "{}",
            "packages/parallel_test.js": "// not a package\n",
            "packages/loose-dir/readme.md": "no manifest here\n"
        },
        (root) => {
            assert.equal(survey({ repoRoot: root }).total, 2);
        }
    );
});

test("sorts packages into mechanical, needs-a-decision, and already ESM", () => {
    withTree(
        {
            "packages/clean/package.json": JSON.stringify({ name: "clean", files: ["source"] }),
            "packages/clean/source/a.ts": "export const x = 1;\n",
            "packages/needs/package.json": JSON.stringify({ name: "needs", files: ["source"] }),
            "packages/needs/source/a.ts": 'const info = require("../package.json");\n',
            "packages/done/package.json": JSON.stringify({ name: "done", type: "module" })
        },
        (root) => {
            const s = survey({ repoRoot: root });
            assert.deepEqual(s.mechanical.map((p) => p.packageName), ["clean"]);
            assert.deepEqual(s.needsDecision.map((p) => p.packageName), ["needs"]);
            assert.deepEqual(s.alreadyEsm.map((p) => p.packageName), ["done"]);
        }
    );
});

test("an unrecognised mocha config keeps a package out of the mechanical set", () => {
    withTree(
        {
            "packages/p/package.json": JSON.stringify({ name: "p" }),
            "packages/p/.mocharc.js": "module.exports = { spec: __dirname };\n"
        },
        (root) => {
            const s = survey({ repoRoot: root });
            assert.equal(s.mechanical.length, 0);
            assert.equal(s.needsDecision.length, 1);
        }
    );
});
