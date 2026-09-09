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

// ── the test-directory list ─────────────────────────────────────────────────────
//
// Shared for the same reason shippedDirsOf is. Three gates each kept their own copy, the
// copies disagreed, and every one was blind to something: two looked for `test_fixtures`
// and missed node-opcua-transport's `test-fixtures`, while check-test-ports looked for
// `test-fixtures` and missed the two packages using the underscore.

test("the test-directory list carries both spellings, because both exist on disk", async () => {
    const { TEST_DIRS } = await import("../test_dirs.mjs");
    assert.ok(TEST_DIRS.includes("test_fixtures"), "underscore form: secure-channel, convert-nodeset");
    assert.ok(TEST_DIRS.includes("test-fixtures"), "hyphen form: node-opcua-transport");
    assert.ok(TEST_DIRS.includes("test"), "the ordinary case");
});

test("every directory this repository uses for tests is in the list", () => {
    const repoRoot = path.resolve(import.meta.dirname, "../../..");
    const packages = path.join(repoRoot, "packages");
    const seen = new Set();
    for (const pkg of fs.readdirSync(packages, { withFileTypes: true })) {
        if (!pkg.isDirectory()) continue;
        for (const entry of fs.readdirSync(path.join(packages, pkg.name), { withFileTypes: true })) {
            if (entry.isDirectory() && /^tests?([-_]|$)/.test(entry.name)) seen.add(entry.name);
        }
    }
    // a directory here that the list does not name is a gate quietly not looking
    return import("../test_dirs.mjs").then(({ TEST_DIRS }) => {
        const missing = [...seen].filter((d) => !TEST_DIRS.includes(d));
        assert.deepEqual(missing, [], `test directories no gate scans: ${missing.join(", ")}`);
    });
});

// ── source behind an emitted directory ──────────────────────────────────────────
//
// The third way this has failed. node-opcua-address-space ships `distHelpers`, and the tree
// that compiles into it, `test_helpers`, is named nowhere in `files`. Excluding build output
// was right; stopping there meant every gate skipped an entire published tree and still
// reported a clean scan. Six raw uses of __dirname were sitting in the gap.

test("an emitted directory in `files` resolves back to the source it is compiled from", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "shipped-dirs-"));
    try {
        const pkg = path.join(root, "p");
        fs.mkdirSync(path.join(pkg, "helpers"), { recursive: true });
        fs.writeFileSync(path.join(pkg, "helpers", "a.ts"), "export const x = 1;");
        fs.writeFileSync(path.join(pkg, "package.json"), JSON.stringify({ name: "p", files: ["distHelpers"] }));
        fs.writeFileSync(
            path.join(pkg, "tsconfig_helpers.json"),
            JSON.stringify({ compilerOptions: { rootDir: "helpers", outDir: "distHelpers" }, include: ["helpers/**/*.ts"] })
        );
        assert.deepEqual(shippedDirsOf(pkg), ["helpers"]);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test("a rootDir naming the package itself does not widen the scan to everything", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "shipped-dirs-"));
    try {
        const pkg = path.join(root, "p");
        for (const d of ["api", "impl", "scratch"]) {
            fs.mkdirSync(path.join(pkg, d), { recursive: true });
            fs.writeFileSync(path.join(pkg, d, "a.ts"), "export const x = 1;");
        }
        fs.writeFileSync(path.join(pkg, "package.json"), JSON.stringify({ name: "p", files: ["dist"] }));
        // rootDir "" is what node-opcua-address-space declares; the include globs are the answer
        fs.writeFileSync(
            path.join(pkg, "tsconfig.json"),
            JSON.stringify({ compilerOptions: { rootDir: "", outDir: "dist" }, include: ["api/**/*.ts", "impl/**/*.ts"] })
        );
        assert.deepEqual(shippedDirsOf(pkg).sort(), ["api", "impl"]);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test("node-opcua-address-space's test_helpers tree is in scope", () => {
    const repoRoot = path.resolve(import.meta.dirname, "../../..");
    const dirs = shippedDirsOf(path.join(repoRoot, "packages", "node-opcua-address-space"));
    assert.ok(dirs.includes("test_helpers"), `found: ${dirs.join(", ")}`);
});
