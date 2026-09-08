/**
 * Tests for the engines rule and its fixer.
 *
 * The fixer edits 113 manifests, so most of these pin what it must NOT disturb: a
 * parse-and-stringify would reformat every file and bury the one-line change.
 */
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { applyFloor, setFloor } from "../src/fix.js";
import { analyze, exitCode, formatReport, publishedPackages, rootFloor } from "../src/rule.js";

/** build a throwaway workspace from a { relativePath: contents } map */
function withTree(files, fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-engines-"));
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

const ROOT = { name: "mono", private: true, engines: { node: ">=22.13.0" } };

// ── reading the floor ───────────────────────────────────────────────────────────

test("reads the floor from the repository root", () => {
    withTree({ "package.json": ROOT }, (root) => assert.equal(rootFloor(root), ">=22.13.0"));
});

test("a root with no engines yields no floor, and the gate says so rather than passing", () => {
    withTree({ "package.json": { name: "mono", private: true } }, (root) => {
        const result = analyze({ repoRoot: root });
        assert.equal(result.expected, undefined);
        assert.equal(exitCode(result), 1);
        assert.match(formatReport(result), /declares no engines\.node/);
    });
});

// ── which packages are in scope ─────────────────────────────────────────────────

test("private packages are out of scope: their engines reach no consumer", () => {
    withTree(
        {
            "package.json": ROOT,
            "packages/pub/package.json": { name: "pub", engines: { node: ">=22.13.0" } },
            "packages/priv/package.json": { name: "priv", private: true }
        },
        (root) => {
            const names = publishedPackages(root).map((p) => p.name);
            assert.deepEqual(names, ["pub"]);
            assert.equal(analyze({ repoRoot: root }).findings.length, 0);
        }
    );
});

test("packages_extra is in scope too", () => {
    withTree(
        {
            "package.json": ROOT,
            "packages/a/package.json": { name: "a", engines: { node: ">=22.13.0" } },
            "packages_extra/b/package.json": { name: "b" }
        },
        (root) => {
            const result = analyze({ repoRoot: root });
            assert.equal(result.scanned, 2);
            assert.deepEqual(
                result.findings.map((f) => f.name),
                ["b"]
            );
        }
    );
});

test("a manifest that cannot be parsed is skipped, not crashed on", () => {
    withTree({ "package.json": ROOT, "packages/broken/package.json": "{ not json" }, (root) => {
        assert.doesNotThrow(() => analyze({ repoRoot: root }));
        assert.equal(analyze({ repoRoot: root }).scanned, 0);
    });
});

// ── what it flags ───────────────────────────────────────────────────────────────

test("a package with no engines is a finding", () => {
    withTree({ "package.json": ROOT, "packages/a/package.json": { name: "a" } }, (root) => {
        const result = analyze({ repoRoot: root });
        assert.equal(result.findings[0].kind, "missing");
        assert.equal(exitCode(result), 1);
        assert.match(formatReport(result), /declare no engines at all/);
    });
});

test("a package with a different floor is a finding", () => {
    withTree({ "package.json": ROOT, "packages/a/package.json": { name: "a", engines: { node: ">=18" } } }, (root) => {
        const result = analyze({ repoRoot: root });
        assert.equal(result.findings[0].kind, "mismatch");
        assert.equal(result.findings[0].actual, ">=18");
        assert.match(formatReport(result), /">=18"/);
    });
});

test("a floor that merely permits the root's is still a finding: equality is the rule", () => {
    withTree({ "package.json": ROOT, "packages/a/package.json": { name: "a", engines: { node: ">=22" } } }, (root) => {
        assert.equal(analyze({ repoRoot: root }).findings.length, 1);
    });
});

test("matching packages report clean", () => {
    withTree({ "package.json": ROOT, "packages/a/package.json": { name: "a", engines: { node: ">=22.13.0" } } }, (root) => {
        const result = analyze({ repoRoot: root });
        assert.equal(exitCode(result), 0);
        assert.match(formatReport(result), /1 published packages, every one declares node >=22\.13\.0/);
    });
});

// ── the fixer, and what it must leave alone ─────────────────────────────────────

test("replaces an existing floor and touches nothing else", () => {
    const text = ['{', '    "name": "a",', '    "engines": {', '        "node": ">=18"', "    },", '    "main": "x.js"', "}", ""].join(
        "\n"
    );
    const out = setFloor(text, ">=22.13.0");
    assert.equal(out, text.replace('">=18"', '">=22.13.0"'));
});

test("returns null when the floor is already right, so no file is rewritten", () => {
    const text = '{\n    "engines": {\n        "node": ">=22.13.0"\n    }\n}\n';
    assert.equal(setFloor(text, ">=22.13.0"), null);
});

test("inserts a block before dependencies when there is no engines key", () => {
    const text = ['{', '    "name": "a",', '    "dependencies": {', '        "x": "1"', "    }", "}", ""].join("\n");
    const out = setFloor(text, ">=22.13.0");
    assert.equal(JSON.parse(out).engines.node, ">=22.13.0");
    assert.equal(JSON.parse(out).dependencies.x, "1");
    // a three-line insertion, nothing else
    assert.equal(out.split("\n").length, text.split("\n").length + 3);
});

test("inserts before files when there are no dependencies", () => {
    const text = ['{', '    "name": "a",', '    "files": [', '        "dist"', "    ]", "}", ""].join("\n");
    const out = setFloor(text, ">=22.13.0");
    assert.equal(JSON.parse(out).engines.node, ">=22.13.0");
    assert.deepEqual(JSON.parse(out).files, ["dist"]);
});

test("inserts before the closing brace when there is no anchor at all", () => {
    const text = '{\n    "name": "a"\n}\n';
    const out = setFloor(text, ">=22.13.0");
    assert.equal(JSON.parse(out).engines.node, ">=22.13.0");
    assert.equal(JSON.parse(out).name, "a");
});

test("adds node to an engines block that has other keys", () => {
    const text = '{\n    "name": "a",\n    "engines": {\n        "pnpm": ">=11"\n    }\n}\n';
    const out = setFloor(text, ">=22.13.0");
    const parsed = JSON.parse(out);
    assert.equal(parsed.engines.node, ">=22.13.0");
    assert.equal(parsed.engines.pnpm, ">=11");
});

test("a brace inside a string does not confuse the block scanner", () => {
    const text = '{\n    "description": "uses { and } chars",\n    "engines": {\n        "node": ">=18"\n    }\n}\n';
    const out = setFloor(text, ">=22.13.0");
    const parsed = JSON.parse(out);
    assert.equal(parsed.engines.node, ">=22.13.0");
    assert.equal(parsed.description, "uses { and } chars");
});

test("applyFloor writes every published package and leaves private ones alone", () => {
    withTree(
        {
            "package.json": ROOT,
            "packages/a/package.json": { name: "a" },
            "packages/b/package.json": { name: "b", engines: { node: ">=18" } },
            "packages/priv/package.json": { name: "priv", private: true }
        },
        (root) => {
            const { changed } = applyFloor({ repoRoot: root });
            assert.equal(changed, 2);
            assert.equal(analyze({ repoRoot: root }).findings.length, 0);
            const priv = JSON.parse(fs.readFileSync(path.join(root, "packages/priv/package.json"), "utf8"));
            assert.equal(priv.engines, undefined);
        }
    );
});

test("applyFloor is idempotent: a second run rewrites nothing", () => {
    withTree({ "package.json": ROOT, "packages/a/package.json": { name: "a" } }, (root) => {
        applyFloor({ repoRoot: root });
        assert.equal(applyFloor({ repoRoot: root }).changed, 0);
    });
});
