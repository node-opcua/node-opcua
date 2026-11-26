/**
 * Tests for the release-notes gate.
 *
 * The cases that matter most are the two strictness levels. `format` runs on every pull request,
 * so it must accept a file whose Unreleased section is empty, and even one with no Unreleased
 * section at all right after a release consumed it. `releasable` runs before a release, so it
 * must refuse both of those.
 *
 * The promote cases pin that the heading and its '=' underline move together, and that promote is
 * idempotent: running a release twice must not produce "Release Release 2.188.0".
 */
import assert from "node:assert";
import test from "node:test";
import {
    checkFormat,
    checkReleasable,
    formatProblems,
    parseSections,
    promote,
    UNRELEASED,
    versionFromLerna
} from "../src/rule.js";

const lines = (...l) => `${l.join("\n")}\n`;

const WITH_BULLET = lines(
    "Unreleased",
    "==========",
    "",
    "  - server: it does the thing now. (#1234)",
    "",
    "Release 2.187.35",
    "================",
    "",
    "  - something older.",
    ""
);

const EMPTY_UNRELEASED = lines(
    "Unreleased",
    "==========",
    "",
    "Release 2.187.35",
    "================",
    "",
    "  - something older.",
    ""
);

const JUST_RELEASED = lines(
    "Release 2.188.0",
    "===============",
    "",
    "  - server: it does the thing now. (#1234)",
    ""
);

// ── parsing ─────────────────────────────────────────────────────────────────────

test("reads every section in order", () => {
    const s = parseSections(WITH_BULLET);
    assert.deepEqual(
        s.map((x) => x.title),
        ["Unreleased", "Release 2.187.35"]
    );
});

test("a section keeps its body", () => {
    const s = parseSections(WITH_BULLET);
    assert.ok(s[0].body.some((l) => l.includes("does the thing")));
    assert.ok(!s[0].body.some((l) => l.includes("something older")));
});

test("a line of '=' is not a title", () => {
    assert.equal(parseSections(lines("===", "===")).length, 0);
});

// ── format: runs on every pull request ──────────────────────────────────────────

test("format accepts a file with a bullet", () => {
    assert.deepEqual(checkFormat(WITH_BULLET), []);
});

test("format accepts an EMPTY Unreleased section", () => {
    assert.deepEqual(checkFormat(EMPTY_UNRELEASED), []);
});

test("format accepts a file with no Unreleased section at all", () => {
    assert.deepEqual(checkFormat(JUST_RELEASED), []);
});

test("format accepts a descriptive heading that carries its release in brackets", () => {
    const doc = lines(
        "Release 2.188.0",
        "===============",
        "",
        "  - a bullet.",
        "",
        "OPC UA JSON follows Part 6 1.04 and 1.05 [2.187.10]",
        "===================================================",
        "",
        "  - older.",
        ""
    );
    assert.deepEqual(checkFormat(doc), []);
});

test("format accepts a legacy version 0.4x heading", () => {
    const doc = lines("Release 2.188.0", "===============", "", "  - a.", "", "version 0.41", "============", "");
    assert.deepEqual(checkFormat(doc), []);
});

test("format refuses an underline of the wrong length", () => {
    const p = checkFormat(lines("Unreleased", "====", "", "  - a bullet.", ""));
    assert.equal(p.length, 1);
    assert.match(p[0], /underline is 4 long, the title "Unreleased" is 10/);
});

test("format refuses a first section that is neither Unreleased nor a Release", () => {
    const p = checkFormat(lines("Some feature", "============", "", "  - a bullet.", ""));
    assert.ok(p.some((x) => /must be "Unreleased" or "Release X\.Y\.Z"/.test(x)));
});

test("format refuses two Unreleased sections", () => {
    const doc = lines("Unreleased", "==========", "", "  - a.", "", "Unreleased", "==========", "", "  - b.", "");
    assert.ok(checkFormat(doc).some((x) => /there can be only one/.test(x)));
});

test("format refuses an Unreleased section that is not first", () => {
    const doc = lines(
        "Release 2.188.0",
        "===============",
        "",
        "  - a.",
        "",
        "Unreleased",
        "==========",
        "",
        "  - b.",
        ""
    );
    assert.ok(checkFormat(doc).some((x) => /is not the first section/.test(x)));
});

test("format refuses a document with no section", () => {
    assert.ok(checkFormat("just prose\n").some((x) => /no section found/.test(x)));
});

// ── releasable: runs before a release ───────────────────────────────────────────

test("releasable accepts an Unreleased section with a bullet", () => {
    assert.deepEqual(checkReleasable(WITH_BULLET), []);
});

test("releasable REFUSES an empty Unreleased section", () => {
    const p = checkReleasable(EMPTY_UNRELEASED);
    assert.equal(p.length, 1);
    assert.match(p[0], /carries no bullet/);
});

test("releasable REFUSES a file whose previous release consumed the section", () => {
    const p = checkReleasable(JUST_RELEASED);
    assert.ok(p.some((x) => /the notes of this release are missing/.test(x)));
});

test("releasable counts a bullet at any indent", () => {
    const flat = lines("Unreleased", "==========", "", "- server: a bullet with no indent.", "");
    assert.deepEqual(checkReleasable(flat), []);
});

test("releasable does not count a dash with nothing after it", () => {
    const p = checkReleasable(lines("Unreleased", "==========", "", "-", ""));
    assert.ok(p.some((x) => /carries no bullet/.test(x)));
});

// ── promote ─────────────────────────────────────────────────────────────────────

test("promote renames the heading and resizes the underline together", () => {
    const { text, changed, from, to } = promote(WITH_BULLET, "2.188.0");
    assert.equal(changed, true);
    assert.equal(from, UNRELEASED);
    assert.equal(to, "Release 2.188.0");
    const first = text.split("\n");
    assert.equal(first[0], "Release 2.188.0");
    assert.equal(first[1], "=".repeat("Release 2.188.0".length));
});

test("promote leaves the body exactly as written", () => {
    const { text } = promote(WITH_BULLET, "2.188.0");
    assert.ok(text.includes("  - server: it does the thing now. (#1234)"));
    assert.ok(text.includes("Release 2.187.35"));
});

test("promote is idempotent for the same version", () => {
    const once = promote(WITH_BULLET, "2.188.0");
    const twice = promote(once.text, "2.188.0");
    assert.equal(twice.changed, false);
    assert.equal(twice.error, undefined);
    assert.equal(twice.text, once.text);
});

test("promote refuses when the top section is another release", () => {
    const { changed, error } = promote(JUST_RELEASED, "2.189.0");
    assert.equal(changed, false);
    assert.match(error, /is "Release 2\.188\.0", not "Unreleased"/);
});

test("promote refuses a version that is not a version", () => {
    assert.match(promote(WITH_BULLET, "v2.188").error, /not a version/);
    assert.match(promote(WITH_BULLET, undefined).error, /not a version/);
});

test("promote does not touch a file with no section", () => {
    assert.match(promote("just prose\n", "2.188.0").error, /no section found/);
});

// ── the version lerna writes ────────────────────────────────────────────────────

test("reads the version from lerna.json", () => {
    assert.equal(versionFromLerna('{"version":"2.188.0"}').version, "2.188.0");
});

test("reports lerna.json that does not parse", () => {
    assert.match(versionFromLerna("{nope").error, /does not parse/);
});

test("reports lerna.json with no version", () => {
    assert.match(versionFromLerna('{"packages":[]}').error, /no version string/);
});

// ── reporting ───────────────────────────────────────────────────────────────────

test("says the file is in order when it is", () => {
    assert.match(formatProblems([], "RELEASE_NOTES.md"), /is in order/);
});

test("prefixes each problem with ERROR and the file", () => {
    const out = formatProblems(["a", "b"], "RELEASE_NOTES.md");
    assert.equal(out.split("\n").length, 2);
    assert.ok(out.split("\n").every((l) => l.startsWith("ERROR RELEASE_NOTES.md: ")));
});
