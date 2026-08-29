/**
 * Unit tests for the top-level-await detector.
 *
 * The negative fixtures matter more than the positive ones. Anything can find the word
 * "await"; the job here is to not flag the shapes this repo is full of - async IIFEs,
 * async class methods, callbacks passed to map/forEach - because a tool that cries wolf
 * gets its CI step deleted, and then the real one goes unnoticed.
 *
 * Run: node test/test_detector.js   (node:test needs no --test flag)
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { findTopLevelAwait, analyze, findSourceFiles, exitCode, formatReport } from "../src/detector.js";

// --- flagged: await that really is evaluated at module scope ---------------------

const POSITIVE = {
    "bare statement": `
import { load } from "./load";
const config = await load();
export { config };
`,
    "inside an if": `
import { probe } from "./probe";
if (process.env.X) {
    await probe();
}
`,
    "inside a try": `
try {
    await import("./optional");
} catch {
    // ignore
}
`,
    "inside a bare block": `
{
    await ready();
}
`,
    "for await at module scope": `
for await (const chunk of stream) {
    console.log(chunk);
}
`,
    "in an exported initializer": `
export const nodesets = await readNodesets();
`,
    "inside a top-level arrow's default argument position": `
const later = await Promise.resolve(1);
export default later;
`
};

for (const [name, source] of Object.entries(POSITIVE)) {
    test(`flags: ${name}`, () => {
        const found = findTopLevelAwait(source, "a.ts");
        assert.ok(found.length >= 1, `expected a finding in:\n${source}`);
    });
}

// --- not flagged: await inside some function scope -------------------------------

const NEGATIVE = {
    "async function declaration": `
export async function connect() {
    await socket.open();
}
`,
    "async arrow IIFE, the legitimate workaround": `
(async () => {
    await main();
})();
`,
    "async class method": `
export class Client {
    async connect() {
        await this.channel.open();
    }
}
`,
    "async method in an object literal": `
export const api = {
    async read() {
        await fetch("/x");
    }
};
`,
    "callback passed to map": `
const results = items.map(async (item) => await handle(item));
`,
    "await inside a getter": `
class C {
    get value() {
        return (async () => await compute())();
    }
}
`,
    "nested function inside a top-level call": `
register(function () {
    return (async function inner() {
        await tick();
    })();
});
`,
    "the word await in a string and a comment": `
// we deliberately await nothing here
const message = "await the server";
const template = \`please await \${name}\`;
`,
    "a property named await": `
const o = { await: 1 };
console.log(o.await);
`,
    "async generator method": `
class S {
    async *stream() {
        for await (const c of src) {
            yield c;
        }
    }
}
`,
    "constructor delegating to an async helper": `
class C {
    constructor() {
        this.ready = (async () => {
            await init();
        })();
    }
}
`
};

for (const [name, source] of Object.entries(NEGATIVE)) {
    test(`does not flag: ${name}`, () => {
        const found = findTopLevelAwait(source, "a.ts");
        assert.deepEqual(found, [], `unexpected finding in:\n${source}\ngot ${JSON.stringify(found)}`);
    });
}

// --- reported position and kind --------------------------------------------------

test("reports a 1-based line, the source line, and the kind", () => {
    const found = findTopLevelAwait("const a = 1;\nconst b = await c();\n", "a.ts");
    assert.equal(found.length, 1);
    assert.equal(found[0].line, 2);
    assert.equal(found[0].kind, "await");
    assert.equal(found[0].text, "const b = await c();");
});

test("distinguishes for-await from a plain await", () => {
    const found = findTopLevelAwait("for await (const x of y) {}\n", "a.ts");
    assert.equal(found.length, 1);
    assert.equal(found[0].kind, "for await");
});

test("finds every occurrence, not just the first", () => {
    const found = findTopLevelAwait("const a = await x();\nconst b = await y();\n", "a.ts");
    assert.equal(found.length, 2);
});

// --- plain JavaScript, not only TypeScript ---------------------------------------

test("parses .mjs as well as .ts", () => {
    assert.equal(findTopLevelAwait("const a = await x();\n", "a.mjs").length, 1);
    assert.equal(findTopLevelAwait("async function f() { await x(); }\n", "a.mjs").length, 0);
});

test("TypeScript-only syntax does not derail the parse", () => {
    const source = `
interface Options { port: number }
type Handler = (o: Options) => Promise<void>;
enum Kind { A, B }
export const value = await load<Options>();
`;
    const found = findTopLevelAwait(source, "a.ts");
    assert.equal(found.length, 1);
});

// --- tree walking -----------------------------------------------------------------

function withFixtureTree(files, fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-no-tla-"));
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

test("scans source/ and src/, skipping tests, dist and .d.ts", () => {
    withFixtureTree(
        {
            "pkg-a/source/index.ts": "const a = await x();\n",
            "pkg-b/src/index.ts": "const b = await y();\n",
            "pkg-c/source/index.d.ts": "declare const c: number;\n",
            "pkg-c/source/ok.ts": "async function f() { await z(); }\n",
            "pkg-d/test/test_thing.ts": "const d = await w();\n",
            "pkg-e/dist/index.js": "const e = await v();\n"
        },
        (root) => {
            const result = analyze(root);
            const hit = result.findings.map((f) => f.file.replace(/\\/g, "/"));
            assert.equal(hit.length, 2, `got ${JSON.stringify(hit)}`);
            assert.ok(hit.some((f) => f.endsWith("pkg-a/source/index.ts")));
            assert.ok(hit.some((f) => f.endsWith("pkg-b/src/index.ts")));

            const scanned = findSourceFiles(root).map((f) => f.replace(/\\/g, "/"));
            assert.ok(!scanned.some((f) => f.includes("/test/")), "test trees must not be scanned");
            assert.ok(!scanned.some((f) => f.includes("/dist/")), "dist must not be scanned");
            assert.ok(!scanned.some((f) => f.endsWith(".d.ts")), "declarations must not be scanned");
        }
    );
});

test("a clean tree exits 0, a dirty one exits 1", () => {
    withFixtureTree({ "pkg/source/index.ts": "async function f() { await x(); }\n" }, (root) => {
        const result = analyze(root);
        assert.equal(exitCode(result), 0);
        assert.match(formatReport(result), /no module-scope await/);
    });
    withFixtureTree({ "pkg/source/index.ts": "const a = await x();\n" }, (root) => {
        const result = analyze(root);
        assert.equal(exitCode(result), 1);
        assert.match(formatReport(result), /pkg\/source\/index\.ts:1/);
    });
});

test("a missing root is not an error, it is an empty scan", () => {
    const result = analyze(path.join(os.tmpdir(), "check-no-tla-does-not-exist"));
    assert.equal(result.scanned, 0);
    assert.equal(exitCode(result), 0);
});
