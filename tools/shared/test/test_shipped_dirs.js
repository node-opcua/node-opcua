/**
 * Tests for shipped_dirs - the module every gate uses to decide what it looks at.
 *
 * Worth its own suite because a mistake here is silent in exactly the way the gates are
 * meant to prevent: scan too narrow and every one of them reports "clean" on a tree it
 * never opened.
 */
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { allShippedDirNames, shippedDirsOf } from "../shipped_dirs.mjs";

/** build a throwaway package directory from a { relativePath: contents } map */
function withPackage(files, fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "shipped-dirs-"));
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

const manifest = (files) => JSON.stringify({ name: "p", ...(files ? { files } : {}) });

test("reads the directories a package says it publishes", () => {
    withPackage(
        {
            "package.json": manifest(["api", "impl"]),
            "api/a.ts": "",
            "impl/b.ts": ""
        },
        (root) => assert.deepEqual(shippedDirsOf(root).sort(), ["api", "impl"])
    );
});

test("ignores a listed directory that holds no TypeScript we author", () => {
    withPackage(
        {
            "package.json": manifest(["source", "nodesets", "certificates"]),
            "source/a.ts": "",
            "nodesets/Opc.Ua.NodeSet2.xml": "<x/>",
            "certificates/cert.pem": ""
        },
        (root) => assert.deepEqual(shippedDirsOf(root), ["source"])
    );
});

test("a directory of declarations only is not source", () => {
    withPackage(
        {
            "package.json": manifest(["source", "typings"]),
            "source/a.ts": "",
            "typings/global.d.ts": ""
        },
        (root) => assert.deepEqual(shippedDirsOf(root), ["source"])
    );
});

test("build output is excluded however it is named", () => {
    withPackage(
        {
            "package.json": manifest(["dist", "distNodeJS", "distHelpers", "source"]),
            // .ts under dist happens: sourcemaps and stray copies. It is emitted, not authored.
            "dist/a.ts": "",
            "distNodeJS/b.ts": "",
            "distHelpers/c.ts": "",
            "source/d.ts": ""
        },
        (root) => assert.deepEqual(shippedDirsOf(root), ["source"])
    );
});

test("a single file in `files` is not mistaken for a directory", () => {
    withPackage(
        {
            "package.json": manifest(["nodeJS.js", "nodeJS.d.ts", "source"]),
            "nodeJS.js": "",
            "nodeJS.d.ts": "",
            "source/a.ts": ""
        },
        (root) => assert.deepEqual(shippedDirsOf(root), ["source"])
    );
});

test("a glob in `files` is skipped rather than guessed at", () => {
    withPackage({ "package.json": manifest(["dist/**/*", "source"]), "source/a.ts": "" }, (root) =>
        assert.deepEqual(shippedDirsOf(root), ["source"])
    );
});

test("trailing slashes and leading ./ are tolerated", () => {
    withPackage({ "package.json": manifest(["./source/"]), "source/a.ts": "" }, (root) =>
        assert.deepEqual(shippedDirsOf(root), ["source"])
    );
});

test("nested TypeScript counts: a tree is source even when its root holds none", () => {
    withPackage({ "package.json": manifest(["api"]), "api/interfaces/deep/a.ts": "" }, (root) =>
        assert.deepEqual(shippedDirsOf(root), ["api"])
    );
});

// ── falling back, which must always widen and never narrow ──────────────────────

test("no `files` at all means the conventional layout", () => {
    withPackage({ "package.json": manifest(null), "source/a.ts": "", "src/b.ts": "" }, (root) =>
        assert.deepEqual(shippedDirsOf(root).sort(), ["source", "src"])
    );
});

test("no manifest at all still yields the conventional layout", () => {
    withPackage({ "source/a.ts": "" }, (root) => assert.deepEqual(shippedDirsOf(root), ["source"]));
});

test("an unparseable manifest falls back rather than scanning nothing", () => {
    withPackage({ "package.json": "{ not json", "source/a.ts": "" }, (root) =>
        assert.deepEqual(shippedDirsOf(root), ["source"])
    );
});

test("`files` naming only build output still gets the conventional layout scanned", () => {
    // the shape that started this: publish `dist`, author `source`, and a gate keyed on
    // `files` alone would have looked at nothing at all
    withPackage({ "package.json": manifest(["dist"]), "dist/a.ts": "", "source/b.ts": "" }, (root) =>
        assert.deepEqual(shippedDirsOf(root), ["source"])
    );
});

test("the caller chooses the fallback", () => {
    withPackage({ "package.json": manifest(null), "lib/a.ts": "" }, (root) =>
        assert.deepEqual(shippedDirsOf(root, ["lib"]), ["lib"])
    );
});

test("a fallback directory that does not exist is not returned", () => {
    withPackage({ "package.json": manifest(null), "source/a.ts": "" }, (root) =>
        assert.deepEqual(shippedDirsOf(root), ["source"])
    );
});

// ── against the repository itself ───────────────────────────────────────────────

test("every directory this repository ships is one the gates now scan", () => {
    const repoRoot = path.resolve(import.meta.dirname, "../../..");
    const names = allShippedDirNames(repoRoot);

    // the pair the gates used to hardcode
    assert.ok(names.includes("source"), names.join());
    assert.ok(names.includes("src"), names.join());

    // and the three they silently missed: source_nodejs in several packages, and the
    // api/impl split, which left coverage the day the directories were renamed
    for (const missed of ["source_nodejs", "api", "impl"]) {
        assert.ok(names.includes(missed), `${missed} not discovered, found: ${names.join()}`);
    }
});
