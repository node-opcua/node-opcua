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
import {
    analyze,
    classifyJsFiles,
    computeLiveJsFiles,
    convertAnchors,
    convertDynamicRequire,
    entryShim,
    findManualWork,
    mocharcRename,
    parseDtsReexport,
    parseEntryShim,
    resolveEntrySpecifier,
    setTypeModule,
    survey
} from "../src/rule.js";

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
//
// The config stays CommonJS and is renamed. check-mocharc mandates .cjs for an ESM package
// and renders the canonical content, so converting it here would give one file two
// generators. It is a test config, never published, so there is no ESM purity to gain.

test("an ESM package's config is renamed to .cjs, not rewritten", () => {
    withTree({ "p/package.json": JSON.stringify({ name: "p" }), "p/.mocharc.js": "module.exports = {};" }, (root) => {
        const r = mocharcRename(path.join(root, "p"));
        assert.equal(path.basename(r.from), ".mocharc.js");
        assert.equal(path.basename(r.to), ".mocharc.cjs");
    });
});

test("a package with no config needs no rename", () => {
    withTree({ "p/package.json": JSON.stringify({ name: "p" }) }, (root) => {
        assert.equal(mocharcRename(path.join(root, "p")), null);
    });
});

test("an existing .cjs is never overwritten by the rename", () => {
    withTree(
        {
            "p/package.json": JSON.stringify({ name: "p" }),
            "p/.mocharc.js": "module.exports = {};",
            "p/.mocharc.cjs": "module.exports = { timeout: 1 };"
        },
        (root) => {
            assert.equal(mocharcRename(path.join(root, "p")), null);
        }
    );
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

test("converts a scattered use too: in an ES module the substitution is exact anywhere", () => {
    // FEAT-1's single anchor was for the CJS period, when import.meta was illegal (TS1470).
    // Once a package is being flipped there is nothing left to decide, and test trees - which
    // check-dirname does not cover - are full of these.
    assert.equal(convertAnchors('const p = path.join(__dirname, "x");'), 'const p = path.join(import.meta.dirname, "x");');
});

test("leaves a typeof guard alone: it is asking whether the global exists", () => {
    assert.equal(convertAnchors('const isBrowser = typeof __filename === "undefined";'), null);
});

test("does not rewrite prose: a comment mentioning __dirname is not code", () => {
    assert.equal(convertAnchors('// path.join(__dirname, "x") is the intended use'), null);
});

// ── what needs a person ─────────────────────────────────────────────────────────

test("a literal require is mechanical: createRequire is faithful in any context", () => {
    assert.equal(findManualWork('const { x } = require("./thing");\n').length, 0);
    assert.match(convertDynamicRequire('const { x } = require("./thing");\n'), /createRequire\(import\.meta\.url\)/);
});

test("import() is deliberately not used: it needs an async call site and an emitted .js", () => {
    // tried on extra_data_type_manager and it broke three tests - under tsx the sources are
    // .ts, so import("./x.js") asks the loader for a file that only exists after a build
    assert.doesNotMatch(convertDynamicRequire('const x = require("./thing");\n'), /await import/);
});

test("a file with no require is left alone", () => {
    assert.equal(convertDynamicRequire('import { x } from "./thing.js";\n'), null);
});

test("a file already using createRequire is not given a second one", () => {
    const once = convertDynamicRequire("const usage = require(m);\n");
    assert.equal(convertDynamicRequire(once), null);
});

test("reports a require of package.json separately: it has its own options", () => {
    const found = findManualWork('const info = require("../package.json");\n');
    assert.equal(found[0].kind, "require-json");
});

test("a non-literal require is mechanical too, and stays opaque to bundlers", () => {
    assert.equal(findManualWork("const usage = require(usageModule);\n").length, 0);
    const out = convertDynamicRequire("const usage = require(usageModule);\n");
    assert.match(out, /createRequire/);
    assert.match(out, /require\(usageModule\)/);
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

test("reports `exports.foo`, which is neither module.exports nor an ES export", () => {
    // this is what node-opcua-utils carried: a no-op duplicate under CJS emit, and a
    // ReferenceError the moment the package became a module
    const found = findManualWork("export function f() {}\nexports.f = f;");
    assert.equal(found[0].kind, "cjs-exports");
});

test("an export declaration is not an `exports` assignment", () => {
    assert.equal(findManualWork("export const exports2 = 1;").length, 0);
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
            assert.equal(r.mocharc, "rename");
            assert.equal(r.anchors.length, 1);
            assert.equal(r.manual.length, 1);
            assert.equal(r.manual[0].kind, "require-json");
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

// ── the entry shim ──────────────────────────────────────────────────────────────
//
// `packageFiles` only ever looked at .ts/.mts/.cts, so a package whose entry point is a
// one-line CommonJS `.js` file was invisible to every check. Once the package is ESM that
// file is parsed as ESM too, so `module.exports = require(...)` has to become `export * from`.

test("resolves a shim specifier that already names a built directory", () => {
    withTree({ "p/package.json": JSON.stringify({ name: "p" }), "p/built/index.js": "" }, (root) => {
        assert.equal(resolveEntrySpecifier(path.join(root, "p"), "./built"), "./built/index.js");
    });
});

test("resolves a shim specifier through a tsconfig outDir, so a dist that is not built yet still resolves", () => {
    withTree(
        {
            "p/package.json": JSON.stringify({ name: "p" }),
            "p/tsconfig.json": JSON.stringify({ compilerOptions: { outDir: "./distX" }, include: ["source/**"] })
        },
        (root) => {
            assert.equal(resolveEntrySpecifier(path.join(root, "p"), "./distX"), "./distX/index.js");
        }
    );
});

test("keeps a shim specifier that already ends in .js", () => {
    withTree({ "p/package.json": JSON.stringify({ name: "p" }) }, (root) => {
        assert.equal(resolveEntrySpecifier(path.join(root, "p"), "./built/index.js"), "./built/index.js");
    });
});

test("refuses a shim specifier that is not a relative path: it cannot be resolved with confidence", () => {
    withTree({ "p/package.json": JSON.stringify({ name: "p" }) }, (root) => {
        assert.equal(resolveEntrySpecifier(path.join(root, "p"), "some-package"), null);
    });
});

test("entryShim rewrites the shim and keeps its leading comment lines", () => {
    withTree(
        {
            "p/package.json": JSON.stringify({ name: "p" }),
            "p/nodeJS.js": '// A named entry point.\n// Internal to the monorepo.\nmodule.exports = require("./distNodeJS");'
        },
        (root) => {
            const shim = entryShim(path.join(root, "p"), path.join(root, "p", "nodeJS.js"));
            assert.equal(shim.resolved, "./distNodeJS.js");
            assert.equal(shim.rewritten, '// A named entry point.\n// Internal to the monorepo.\nexport * from "./distNodeJS.js";\n');
        }
    );
});

test("entryShim also rewrites the .d.ts twin when its specifier still lacks an extension", () => {
    withTree(
        {
            "p/package.json": JSON.stringify({ name: "p" }),
            "p/nodeJS.js": 'module.exports = require("./distNodeJS");',
            "p/nodeJS.d.ts": 'export * from "./distNodeJS";\n'
        },
        (root) => {
            const shim = entryShim(path.join(root, "p"), path.join(root, "p", "nodeJS.js"));
            assert.equal(shim.dts.rewritten, 'export * from "./distNodeJS.js";\n');
        }
    );
});

test("entryShim leaves the .d.ts twin alone once its specifier already has an extension", () => {
    withTree(
        {
            "p/package.json": JSON.stringify({ name: "p" }),
            "p/testHelpers.js": 'module.exports = require("./dist/test_helpers/index.js");',
            "p/testHelpers.d.ts": 'export * from "./dist/test_helpers/index.js";\n'
        },
        (root) => {
            const shim = entryShim(path.join(root, "p"), path.join(root, "p", "testHelpers.js"));
            assert.equal(shim.dts, null);
        }
    );
});

test("entryShim reports rather than rewrites when the specifier cannot be resolved", () => {
    withTree({ "p/package.json": JSON.stringify({ name: "p" }), "p/nodeJS.js": 'module.exports = require("some-package");' }, (root) => {
        const shim = entryShim(path.join(root, "p"), path.join(root, "p", "nodeJS.js"));
        assert.equal(shim.resolved, null);
        assert.equal(shim.spec, "some-package");
    });
});

test("parseEntryShim refuses a file with more than the one statement", () => {
    assert.equal(parseEntryShim('require("side-effect");\nmodule.exports = require("./x");\n'), null);
});

test("parseDtsReexport reads a bare export * from", () => {
    assert.equal(parseDtsReexport('export * from "./distNodeJS";\n'), "./distNodeJS");
});

// ── CommonJS left in a .js file ─────────────────────────────────────────────────

test("a shipped CommonJS .js file needs a decision", () => {
    withTree(
        {
            "packages/p/package.json": JSON.stringify({ name: "p", files: ["src"] }),
            "packages/p/src/thing.js": 'const y = require("y");\nmodule.exports = { y };\n'
        },
        (root) => {
            const liveness = computeLiveJsFiles(root);
            const { cjsModules, deadFiles } = classifyJsFiles(path.join(root, "packages/p"), "p", liveness);
            assert.equal(cjsModules.length, 1);
            assert.equal(cjsModules[0].kind, "cjs-module");
            assert.equal(deadFiles.length, 0);
        }
    );
});

test("an unreferenced CommonJS .js in a private package needs a decision too: it is run by hand", () => {
    withTree(
        {
            "packages/p/package.json": JSON.stringify({ name: "p", private: true }),
            "packages/p/script.js": 'const y = require("y");\nmodule.exports = { y };\n'
        },
        (root) => {
            const liveness = computeLiveJsFiles(root);
            const { cjsModules, deadFiles } = classifyJsFiles(path.join(root, "packages/p"), "p", liveness);
            assert.equal(cjsModules.length, 1);
            assert.equal(deadFiles.length, 0);
        }
    );
});

test("a mutually-referencing pair of unshipped CommonJS files stays dead", () => {
    withTree(
        {
            "packages/p/package.json": JSON.stringify({ name: "p", files: ["source"] }),
            "packages/p/source/a.ts": "export const x = 1;\n",
            "packages/p/scripts/a.js": 'require("./b.js");\nmodule.exports = 1;\n',
            "packages/p/scripts/b.js": 'require("./a.js");\nmodule.exports = 2;\n'
        },
        (root) => {
            const liveness = computeLiveJsFiles(root);
            const { deadFiles, cjsModules } = classifyJsFiles(path.join(root, "packages/p"), "p", liveness);
            assert.equal(cjsModules.length, 0);
            assert.equal(deadFiles.length, 2);
            assert.deepEqual(
                deadFiles.map((d) => d.kind),
                ["cjs-dead", "cjs-dead"]
            );
        }
    );
});

test("a .cjs file is left alone: its extension already says what it is", () => {
    withTree(
        {
            "packages/p/package.json": JSON.stringify({ name: "p" }),
            "packages/p/thing.cjs": "module.exports = 1;\n"
        },
        (root) => {
            const liveness = computeLiveJsFiles(root);
            const { cjsModules, deadFiles } = classifyJsFiles(path.join(root, "packages/p"), "p", liveness);
            assert.equal(cjsModules.length, 0);
            assert.equal(deadFiles.length, 0);
        }
    );
});

test("an ESM .js file is not reported", () => {
    withTree(
        {
            "packages/p/package.json": JSON.stringify({ name: "p" }),
            "packages/p/thing.js": "export const x = 1;\n"
        },
        (root) => {
            const liveness = computeLiveJsFiles(root);
            const { cjsModules, deadFiles, shims, cjsEntries } = classifyJsFiles(path.join(root, "packages/p"), "p", liveness);
            assert.equal(cjsModules.length, 0);
            assert.equal(deadFiles.length, 0);
            assert.equal(shims.length, 0);
            assert.equal(cjsEntries.length, 0);
        }
    );
});

test("typeof __filename is reported, not converted: the value is always undefined under ESM", () => {
    const found = findManualWork('const x = typeof __filename === "undefined" ? "a" : __filename;\n');
    assert.equal(found[0].kind, "typeof-cjs-global");
});

test("analyze wires the shim rewrite and CommonJS reports into one result", () => {
    withTree(
        {
            "packages/p/package.json": JSON.stringify({ name: "p", files: ["source", "bin"] }),
            "packages/p/source/a.ts": "export const x = 1;\n",
            "packages/p/nodeJS.js": 'module.exports = require("./distNodeJS");',
            "packages/p/bin/cli.js": 'const y = require("y");\nmodule.exports = { y };\n'
        },
        (root) => {
            const r = analyze({ repoRoot: root, packageName: "p" });
            assert.equal(r.shims.length, 1);
            assert.equal(r.shims[0].resolved, "./distNodeJS.js");
            assert.equal(r.manual.some((m) => m.kind === "cjs-module"), true);
        }
    );
});
