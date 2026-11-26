/**
 * release-notes-gate rule.
 *
 * A note is written in the pull request that makes the change, under an `Unreleased` heading,
 * because the version is chosen when the release is cut and a heading written in a branch would be
 * a guess. The release then stamps the version.
 *
 * Two strictness levels, on purpose:
 *
 *   format      the file is well formed. Safe to run on every pull request, because a CI-only or
 *               test-only change has nothing user-visible to say and must not be blocked.
 *   releasable  `Unreleased` exists and carries at least one bullet. Run before a release only.
 *
 * A section heading is written either way:
 *
 *   ATX      `## Title`               preferred, and what a new section uses
 *   setext   Title over a line of `=`  the older style, still read
 *
 * ATX carries no underline to keep in step with its title, so it removes a whole kind of mistake.
 * The underline length is checked for a setext heading only.
 */

export const UNRELEASED = "Unreleased";
export const RELEASE_RE = /^Release (\d+\.\d+\.\d+)$/;
const LEGACY_RE = /^version \d+\.\d+$/;
const BULLET_RE = /^\s*-\s+\S/;

/**
 * Every section of the document, in order, in either heading style.
 * @returns {{title: string, line: number, atx: boolean, underline?: string, body: string[]}[]}
 */
export function parseSections(text) {
    const lines = text.split(/\r?\n/);
    const marks = [];
    for (let i = 0; i < lines.length; i++) {
        const atx = /^##\s+(.*\S)\s*$/.exec(lines[i]);
        if (atx) {
            marks.push({ title: atx[1], line: i, underline: undefined, atx: true });
            continue;
        }
        if (i + 1 >= lines.length) {
            continue;
        }
        const title = lines[i].trim();
        const underline = lines[i + 1].trim();
        if (title === "" || !/^=+$/.test(underline) || /^=+$/.test(title) || title.startsWith("#")) {
            continue;
        }
        marks.push({ title: lines[i].trimEnd(), line: i, underline: lines[i + 1], atx: false });
    }
    return marks.map((m, k) => {
        const from = m.line + (m.atx ? 1 : 2);
        const to = k + 1 < marks.length ? marks[k + 1].line : lines.length;
        return {
            title: m.title,
            line: m.line,
            atx: m.atx,
            underline: m.underline,
            body: lines.slice(from, to)
        };
    });
}

/** A title this file is allowed to use. */
function titleKind(title) {
    if (title === UNRELEASED) {
        return "unreleased";
    }
    if (RELEASE_RE.test(title)) {
        return "release";
    }
    if (LEGACY_RE.test(title)) {
        return "legacy";
    }
    // a descriptive heading that carries its release in brackets
    if (/\[\d+\.\d+\.\d+\]$/.test(title)) {
        return "stamped";
    }
    return "unknown";
}

/**
 * The file is well formed. This runs on every pull request, so it never asks for content.
 */
export function checkFormat(text) {
    const problems = [];
    const sections = parseSections(text);
    if (sections.length === 0) {
        problems.push("no section found: a section is a title line over a line of '='");
        return problems;
    }
    for (const s of sections) {
        if (s.atx) {
            continue;
        }
        if (s.underline.length !== s.title.length) {
            problems.push(
                `line ${s.line + 2}: the '=' underline is ${s.underline.length} long, the title "${s.title}" is ${s.title.length}`
            );
        }
    }
    const top = sections[0];
    const kind = titleKind(top.title);
    if (kind !== "unreleased" && kind !== "release") {
        problems.push(
            `the first section is "${top.title}": it must be "${UNRELEASED}" or "Release X.Y.Z"`
        );
    }
    const unreleased = sections.filter((s) => s.title === UNRELEASED);
    if (unreleased.length > 1) {
        problems.push(`${unreleased.length} "${UNRELEASED}" sections: there can be only one`);
    }
    if (unreleased.length === 1 && unreleased[0] !== top) {
        problems.push(`"${UNRELEASED}" is not the first section`);
    }
    return problems;
}

/**
 * The release has something to say. This runs before a release only.
 */
export function checkReleasable(text) {
    const problems = checkFormat(text);
    const sections = parseSections(text);
    const top = sections[0];
    if (!top) {
        return problems;
    }
    if (top.title !== UNRELEASED) {
        problems.push(
            `the first section is "${top.title}", not "${UNRELEASED}": the notes of this release are missing, or a previous release did not consume its section`
        );
        return problems;
    }
    if (!top.body.some((l) => BULLET_RE.test(l))) {
        problems.push(
            `the "${UNRELEASED}" section carries no bullet: write what changed, or find out why nothing did`
        );
    }
    return problems;
}

/**
 * Rename the `Unreleased` heading to `Release <version>`, and resize its underline.
 * Returns the new text; `changed` is false when there is nothing to do.
 */
export function promote(text, version) {
    if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
        return { text, changed: false, error: `not a version: "${version}"` };
    }
    const sections = parseSections(text);
    const top = sections[0];
    if (!top) {
        return { text, changed: false, error: "no section found" };
    }
    if (top.title !== UNRELEASED) {
        const m = RELEASE_RE.exec(top.title);
        if (m && m[1] === version) {
            return { text, changed: false, from: top.title };
        }
        return {
            text,
            changed: false,
            error: `the first section is "${top.title}", not "${UNRELEASED}"`
        };
    }
    const lines = text.split(/\r?\n/);
    const title = `Release ${version}`;
    if (top.atx) {
        lines[top.line] = `## ${title}`;
    } else {
        lines[top.line] = title;
        lines[top.line + 1] = "=".repeat(title.length);
    }
    return { text: lines.join("\n"), changed: true, from: UNRELEASED, to: title };
}

/** The version lerna has written, which is the one being released. */
export function versionFromLerna(lernaJson) {
    let parsed;
    try {
        parsed = JSON.parse(lernaJson);
    } catch (err) {
        return { error: `lerna.json does not parse: ${err.message}` };
    }
    if (typeof parsed.version !== "string") {
        return { error: "lerna.json has no version string" };
    }
    return { version: parsed.version };
}

export function formatProblems(problems, file) {
    if (problems.length === 0) {
        return `${file} is in order`;
    }
    return problems.map((p) => `ERROR ${file}: ${p}`).join("\n");
}
