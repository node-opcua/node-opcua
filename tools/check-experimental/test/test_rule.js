/**
 * Tests for the experimental rule.
 *
 * Two groups matter most. The first is the two kinds: an Experimental feature is opt-in and warns
 * at start, an Unstable API is on when you use it and does not warn, and both must be listed. The
 * second is actionability: a name in three places still leaves a reader asking how to turn the
 * thing on and where to read, so a row must say how, and a doc block and a warning must point at
 * EXPERIMENTAL.md.
 */
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
    analyze,
    applyFix,
    compare,
    DOC,
    exitCode,
    findTaggedSymbols,
    findWarnings,
    formatReport,
    KINDS,
    parseTables
} from "../src/rule.js";

function withTree(files, fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-experimental-"));
    try {
        for (const [rel, contents] of Object.entries(files)) {
            const full = path.join(root, rel);
            fs.mkdirSync(path.dirname(full), { recursive: true });
            fs.writeFileSync(full, contents);
        }
        return fn(root);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

const lines = (...l) => `${l.join("\n")}\n`;

const DOCUMENT = lines(
    "# Experimental and unstable parts",
    "",
    "## Experimental features",
    "",
    "| Feature | How you turn it on |",
    "| --- | --- |",
    "| Front-thread engine | the `FrontThreadEngine` class |",
    "",
    "## Unstable APIs",
    "",
    "| Feature | How you turn it on |",
    "| --- | --- |",
    "| The alias store | implement the `IAliasStore` interface |",
    ""
);

const FEATURE = lines(
    "/**",
    ` * Experimental: see ${DOC}.`,
    " * @experimental",
    " */",
    "export class FrontThreadEngine {",
    "    start() {",
    `        warningLog("FrontThreadEngine is experimental, see ${DOC}");`,
    "    }",
    "}"
);

const UNSTABLE = lines(
    "/**",
    ` * @unstable the shape can move, see ${DOC}.`,
    " */",
    "export interface IAliasStore {}"
);

// ── finding a tag ───────────────────────────────────────────────────────────────

test("finds a tagged exported class, and its kind", () => {
    const found = findTaggedSymbols(FEATURE);
    assert.equal(found.length, 1);
    assert.equal(found[0].symbol, "FrontThreadEngine");
    assert.equal(found[0].tag, "@experimental");
});

test("finds a tagged interface property, which carries no export", () => {
    const found = findTaggedSymbols(
        lines("/**", ` * @experimental see ${DOC}`, " */", "    compactAddressSpace?: boolean;")
    );
    assert.equal(found[0].symbol, "compactAddressSpace");
});

test("tells the two kinds apart", () => {
    assert.equal(findTaggedSymbols(UNSTABLE)[0].tag, "@unstable");
});

test("sees whether the doc block points the reader at the document", () => {
    assert.equal(findTaggedSymbols(FEATURE)[0].pointsAtDoc, true);
    const silent = lines("/**", " * @experimental", " */", "export class Quiet {}");
    assert.equal(findTaggedSymbols(silent)[0].pointsAtDoc, false);
});

test("ignores a file with no tag", () => {
    assert.deepEqual(findTaggedSymbols(lines("export class Plain {}")), []);
});

test("walks past intervening comment lines to reach the declaration", () => {
    const found = findTaggedSymbols(
        lines("/**", ` * @experimental ${DOC}`, " */", "// a note", "", "export class Late {}")
    );
    assert.equal(found[0].symbol, "Late");
});

// ── the start-up warning ────────────────────────────────────────────────────────

test("finds a warning that names the symbol and the document", () => {
    const w = findWarnings(FEATURE, ["FrontThreadEngine"]);
    assert.equal(w.get("FrontThreadEngine").pointsAtDoc, true);
});

test("finds a warning that names the symbol but not the document", () => {
    const w = findWarnings(
        lines('warningLog("FrontThreadEngine is experimental");'),
        ["FrontThreadEngine"]
    );
    assert.equal(w.get("FrontThreadEngine").pointsAtDoc, false);
});

test("a doc comment is not a warning", () => {
    const w = findWarnings(lines(" * FrontThreadEngine is experimental"), ["FrontThreadEngine"]);
    assert.equal(w.size, 0);
});

test("a quoted string without the word experimental is not a warning", () => {
    const w = findWarnings(lines('log("FrontThreadEngine started");'), ["FrontThreadEngine"]);
    assert.equal(w.size, 0);
});

// ── the tables ──────────────────────────────────────────────────────────────────

test("reads one table for each heading", () => {
    const tables = parseTables(DOCUMENT);
    assert.equal(tables.get("Experimental features").length, 1);
    assert.equal(tables.get("Unstable APIs").length, 1);
});

test("reads the identifiers of a row from its backticks", () => {
    const rows = parseTables(DOCUMENT).get("Experimental features");
    assert.deepEqual(rows[0].identifiers, ["FrontThreadEngine"]);
});

test("a row whose prose names two identifiers keeps both", () => {
    const tables = parseTables(
        lines(
            "## Experimental features",
            "| Feature | How you turn it on |",
            "| --- | --- |",
            "| Compact address space | the `compactAddressSpace` option of `OPCUAServer` |"
        )
    );
    const rows = tables.get("Experimental features");
    assert.deepEqual(rows[0].identifiers, ["compactAddressSpace", "OPCUAServer"]);
});

test("skips the header and the separator", () => {
    const tables = parseTables(
        lines("## Experimental features", "| Feature | How you turn it on |", "| --- | --- |")
    );
    assert.equal((tables.get("Experimental features") ?? []).length, 0);
});

// ── what disagrees, and what a reader cannot act on ─────────────────────────────

function problemsFor(source, document = DOCUMENT) {
    const tagged = findTaggedSymbols(source);
    return compare({
        tagged,
        tables: parseTables(document),
        warnings: findWarnings(source, tagged.map((t) => t.symbol))
    });
}

test("a tree where everything agrees reports nothing", () => {
    assert.deepEqual(problemsFor(FEATURE + UNSTABLE), []);
});

test("reports a tagged feature that no row names", () => {
    const p = problemsFor(FEATURE, lines("## Experimental features", "| Feature | How you turn it on |", "| --- | --- |"));
    assert.ok(p.some((x) => /FrontThreadEngine is tagged @experimental but no row/.test(x)));
});

test("reports a row that names no tagged symbol", () => {
    const p = problemsFor(UNSTABLE);
    assert.ok(p.some((x) => /"Front-thread engine".*names no symbol tagged @experimental/.test(x)));
});

test("reports a feature whose doc block does not point at the document", () => {
    const silent = lines(
        "/**",
        " * @experimental",
        " */",
        "export class FrontThreadEngine {",
        `    start() { warningLog("FrontThreadEngine is experimental, see ${DOC}"); }`,
        "}"
    );
    const p = problemsFor(silent);
    assert.ok(p.some((x) => /doc block of FrontThreadEngine does not point/.test(x)));
});

test("reports a feature with no start-up warning", () => {
    const noWarning = lines("/**", ` * @experimental see ${DOC}`, " */", "export class FrontThreadEngine {}");
    const p = problemsFor(noWarning);
    assert.ok(p.some((x) => /logs no warning that names it at start/.test(x)));
});

test("reports a warning that does not name the document", () => {
    const vague = lines(
        "/**",
        ` * @experimental see ${DOC}`,
        " */",
        "export class FrontThreadEngine {",
        '    start() { warningLog("FrontThreadEngine is experimental"); }',
        "}"
    );
    const p = problemsFor(vague);
    assert.ok(p.some((x) => /start-up warning of FrontThreadEngine does not name/.test(x)));
});

test("an unstable API needs no start-up warning", () => {
    const p = problemsFor(UNSTABLE + FEATURE);
    assert.ok(!p.some((x) => /IAliasStore.*warning/.test(x)));
});

test("reports a missing table for a kind that has tagged symbols", () => {
    const p = problemsFor(UNSTABLE, lines("## Experimental features", "| Feature | How you turn it on |", "| --- | --- |"));
    assert.ok(p.some((x) => /no "Unstable APIs" table/.test(x)));
});

test("reports a row that does not say how to turn the feature on", () => {
    const document = lines(
        "## Experimental features",
        "| Feature | How you turn it on |",
        "| --- | --- |",
        "| Front-thread engine | FrontThreadEngine |"
    );
    const p = problemsFor(FEATURE, document);
    assert.ok(p.some((x) => /no row under "Experimental features" names it/.test(x)));
});

// ── end to end ──────────────────────────────────────────────────────────────────

test("a repository where everything agrees passes", () => {
    withTree(
        {
            "EXPERIMENTAL.md": DOCUMENT,
            "packages/node-opcua-server/source/a.ts": FEATURE,
            "packages/node-opcua-alias-name-common/source/b.ts": UNSTABLE
        },
        (root) => {
            const result = analyze({ repoRoot: root });
            assert.equal(exitCode(result), 0);
            assert.match(formatReport(result), /agree with the tags/);
            assert.equal(result.tagged.length, 2);
        }
    );
});

test("a missing document fails and says so", () => {
    withTree({ "packages/node-opcua-server/source/a.ts": FEATURE }, (root) => {
        const result = analyze({ repoRoot: root });
        assert.equal(exitCode(result), 1);
        assert.match(formatReport(result), /EXPERIMENTAL\.md is missing/);
    });
});

test("the report lists each kind under its own heading", () => {
    withTree(
        {
            "EXPERIMENTAL.md": DOCUMENT,
            "packages/node-opcua-server/source/a.ts": FEATURE,
            "packages/node-opcua-alias-name-common/source/b.ts": UNSTABLE
        },
        (root) => {
            const report = formatReport(analyze({ repoRoot: root }));
            assert.match(report, /Experimental features \(@experimental\): 1/);
            assert.match(report, /Unstable APIs \(@unstable\): 1/);
        }
    );
});

test("nothing is hidden: an unstable API appears in the listing", () => {
    withTree(
        {
            "EXPERIMENTAL.md": DOCUMENT,
            "packages/node-opcua-server/source/a.ts": FEATURE,
            "packages/node-opcua-alias-name-common/source/b.ts": UNSTABLE
        },
        (root) => {
            const result = analyze({ repoRoot: root });
            assert.ok(result.tagged.some((t) => t.symbol === "IAliasStore"));
        }
    );
});

// ── the fix ─────────────────────────────────────────────────────────────────────

test("the fix adds a row under the heading of its kind", () => {
    const { markdown, added } = applyFix(DOCUMENT, [
        { symbol: "NewStore", section: KINDS["@unstable"].section }
    ]);
    assert.deepEqual(added, ["NewStore"]);
    const rows = parseTables(markdown).get("Unstable APIs");
    assert.equal(rows.length, 2);
    assert.ok(rows.some((r) => r.identifiers.includes("NewStore")));
    assert.equal(parseTables(markdown).get("Experimental features").length, 1);
});

test("the fix places two symbols in two different tables", () => {
    const { markdown, added } = applyFix(DOCUMENT, [
        { symbol: "NewFeature", section: KINDS["@experimental"].section },
        { symbol: "NewStore", section: KINDS["@unstable"].section }
    ]);
    assert.equal(added.length, 2);
    const tables = parseTables(markdown);
    assert.ok(tables.get("Experimental features").some((r) => r.identifiers.includes("NewFeature")));
    assert.ok(tables.get("Unstable APIs").some((r) => r.identifiers.includes("NewStore")));
});

test("the fix changes nothing when nothing is missing", () => {
    const { markdown, added } = applyFix(DOCUMENT, []);
    assert.equal(markdown, DOCUMENT);
    assert.deepEqual(added, []);
});

test("the fix keeps the rows that are already there", () => {
    const { markdown } = applyFix(DOCUMENT, [
        { symbol: "NewStore", section: KINDS["@unstable"].section }
    ]);
    assert.match(markdown, /Front-thread engine/);
    assert.match(markdown, /The alias store/);
});

test("the fix refuses a document with no heading for the kind", () => {
    const { added, error } = applyFix(lines("# nothing here"), [
        { symbol: "X", section: "Unstable APIs" }
    ]);
    assert.deepEqual(added, []);
    assert.match(error, /no "Unstable APIs" heading/);
});
