/**
 * Unit tests for the entry-points rule.
 *
 * The case that matters most is the one this exists for: node-opcua-address-space had
 * main=dist/src/index_current.js against types=dist/source/index.d.ts, and the two lists
 * drifted until twelve declared names were undefined at run time.
 *
 * Run: node test/test_rule.js
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { analyze, classifyEntry, currentCounts, exitCode, exportedSymbols, formatReport, overBaseline, publishedNames, IGNORE_MARKER } from "../src/rule.js";

function withTree(files, fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-entry-"));
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

const pkg = (extra = {}) => JSON.stringify({ name: "p", main: "./dist/index.js", types: "./dist/index.d.ts", ...extra });

test("types beside main is the coherent case", () => {
    assert.equal(classifyEntry({ main: "./dist/index.js", types: "./dist/index.d.ts" }).kind, "ok");
    assert.equal(classifyEntry({ main: "dist/index.js", types: "dist/index.d.ts" }).kind, "ok");
});

test("the address-space shape is a split", () => {
    const v = classifyEntry({ main: "./dist/src/index_current.js", types: "./dist/source/index.d.ts" });
    assert.equal(v.kind, "split");
    assert.equal(v.beside, "dist/src/index_current.d.ts");
});

test("a missing field is reported as its own kind, not as a split", () => {
    assert.equal(classifyEntry({ main: "./dist/index.js" }).kind, "no-types");
    assert.equal(classifyEntry({ types: "./dist/index.d.ts" }).kind, "no-main");
    assert.equal(classifyEntry({}).kind, "no-entry");
});

test("a split fails the gate, whatever the baseline says", () => {
    withTree(
        {
            "packages/p/package.json": pkg({ main: "./dist/src/other.js" }),
            "packages/p/source/index.ts": "export const a = 1;\n"
        },
        (root) => {
            const result = analyze({ repoRoot: root });
            assert.equal(result.entryFindings.length, 1);
            assert.equal(exitCode(result, { p: 999 }), 1, "the baseline covers tags, never the entry split");
            assert.match(formatReport(result, {}), /types and main name different modules/);
        }
    );
});

test("exportedSymbols reports the tag on the declaration", () => {
    const text = "/** @internal */\nexport class FooImpl {}\nexport class BarImpl {}\n";
    const syms = exportedSymbols(text, "x.ts");
    assert.deepEqual(
        syms.map((s) => [s.name, s.tagged]),
        [
            ["FooImpl", true],
            ["BarImpl", false]
        ]
    );
});

test("publishedNames follows export * but not the rest of a named re-export", () => {
    withTree(
        {
            "packages/p/source/index.ts": 'export * from "./all.js";\nexport { justThis } from "./some.js";\n',
            "packages/p/source/all.ts": "export class AllImpl {}\nexport const alsoAll = 1;\n",
            "packages/p/source/some.ts": "export const justThis = 1;\nexport class NotPublishedImpl {}\n"
        },
        (root) => {
            const names = publishedNames(path.join(root, "packages/p/source/index.ts"));
            assert.ok(names.has("AllImpl"));
            assert.ok(names.has("alsoAll"));
            assert.ok(names.has("justThis"));
            assert.ok(!names.has("NotPublishedImpl"), "a named re-export must not pull in its module's other exports");
        }
    );
});

test("an implementation export that the entry does not publish is not a finding", () => {
    withTree(
        {
            "packages/p/package.json": pkg(),
            "packages/p/source/index.ts": 'export { publicThing } from "./api.js";\n',
            "packages/p/source/api.ts": "export const publicThing = 1;\n",
            "packages/p/source/guts.ts": "export class HiddenImpl {}\n"
        },
        (root) => {
            const result = analyze({ repoRoot: root });
            assert.equal(result.internalFindings.length, 0, "HiddenImpl never reaches the documentation");
        }
    );
});

test("an implementation export that IS published, without a tag, is a finding", () => {
    withTree(
        {
            "packages/p/package.json": pkg(),
            "packages/p/source/index.ts": 'export * from "./guts.js";\n',
            "packages/p/source/guts.ts": "export class ShownImpl {}\n"
        },
        (root) => {
            const result = analyze({ repoRoot: root });
            assert.equal(result.internalFindings.length, 1);
            assert.equal(result.internalFindings[0].name, "ShownImpl");
        }
    );
});

test("a tag, or the marker, clears it", () => {
    for (const lead of ["/** @internal */\n", `// ${IGNORE_MARKER} - kept for one release\n`]) {
        withTree(
            {
                "packages/p/package.json": pkg(),
                "packages/p/source/index.ts": 'export * from "./guts.js";\n',
                "packages/p/source/guts.ts": `${lead}export class ShownImpl {}\n`
            },
            (root) => {
                assert.equal(analyze({ repoRoot: root }).internalFindings.length, 0);
            }
        );
    }
});

test("the baseline lets an existing count stand and refuses a larger one", () => {
    withTree(
        {
            "packages/p/package.json": pkg(),
            "packages/p/source/index.ts": 'export * from "./guts.js";\n',
            "packages/p/source/guts.ts": "export class OneImpl {}\nexport class TwoImpl {}\n"
        },
        (root) => {
            const result = analyze({ repoRoot: root });
            assert.equal(exitCode(result, { p: 2 }), 0, "at the baseline");
            assert.equal(exitCode(result, { p: 1 }), 1, "above it");
            assert.equal(exitCode(result, { p: 3 }), 0, "below it, which only means someone removed one");
            assert.deepEqual(currentCounts(result), { p: 2 });
            assert.deepEqual(overBaseline(result, { p: 1 }), [{ package: "p", count: 2, allowed: 1 }]);
        }
    );
});

test("a private package is not checked", () => {
    withTree(
        {
            "packages/p/package.json": JSON.stringify({ name: "p", private: true, main: "./a.js", types: "./b.d.ts" }),
            "packages/p/source/index.ts": "export class ShownImpl {}\n"
        },
        (root) => {
            const result = analyze({ repoRoot: root });
            assert.equal(result.entryFindings.length, 0);
            assert.equal(result.internalFindings.length, 0);
        }
    );
});

test("a clean tree reports what it covered", () => {
    withTree(
        {
            "packages/p/package.json": pkg(),
            "packages/p/source/index.ts": "export const a = 1;\n"
        },
        (root) => {
            const result = analyze({ repoRoot: root });
            assert.equal(exitCode(result, {}), 0);
            assert.match(formatReport(result, {}), /Every types field describes its own main/);
        }
    );
});
