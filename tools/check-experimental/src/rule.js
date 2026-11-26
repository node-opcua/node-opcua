/**
 * check-experimental rule.
 *
 * One record, three derived views. The record is a doc tag on an exported symbol, because a tag
 * cannot move away from the thing it marks. The views are a table in EXPERIMENTAL.md, the warning
 * the code writes at start, and the release note. This rule keeps the first three in agreement.
 *
 * It also checks that each view is **actionable**. A name that appears in three places still
 * leaves a reader asking two questions: how do I turn this on, and where do I read about it. So a
 * row must say how to turn the feature on, a doc block must point at EXPERIMENTAL.md, and a
 * start-up warning must point there too.
 *
 * It compares names and pointers. The prose of a row stays hand written.
 */

import fs from "node:fs";
import path from "node:path";

/** Where a reader goes for the whole story. Every tag and every warning names this file. */
export const DOC = "EXPERIMENTAL.md";

/**
 * The two kinds of maturity, and what each one has to satisfy.
 *
 * An **experimental feature** is opt-in: you turn it on, it is off by default, and it writes a
 * warning at start. The policy of SECURITY.md applies to it.
 *
 * An **unstable API** is already on when you use it. There is no switch and nothing to warn about,
 * but its shape can change in any release. An exported extension point is the usual case.
 *
 * Both appear in EXPERIMENTAL.md, each under its own heading. Nothing is hidden from a reader.
 */
export const KINDS = {
    "@experimental": { section: "Experimental features", needsWarning: true },
    "@unstable": { section: "Unstable APIs", needsWarning: false }
};

/**
 * The declaration forms a tagged symbol can take. The first capture group is the name.
 * The last entry covers an interface property or method, which carries no `export`.
 */
const DECLARATIONS = [
    /^\s*export\s+(?:declare\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/,
    /^\s*export\s+(?:declare\s+)?interface\s+([A-Za-z_$][\w$]*)/,
    /^\s*export\s+(?:declare\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/,
    /^\s*export\s+(?:declare\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/,
    /^\s*export\s+(?:type|enum)\s+([A-Za-z_$][\w$]*)/,
    /^\s*(?:public\s+|readonly\s+|static\s+)*([A-Za-z_$][\w$]*)\s*\??\s*[:(]/
];

function declaredName(line) {
    for (const pattern of DECLARATIONS) {
        const m = pattern.exec(line);
        if (m) {
            return m[1];
        }
    }
    return undefined;
}

function isCommentLine(line) {
    const t = line.trim();
    return t === "" || t.startsWith("*") || t.startsWith("//") || t.startsWith("/*");
}

/**
 * Every symbol in one source file that carries one of the tags.
 *
 * `pointsAtDoc` says whether the doc block names EXPERIMENTAL.md, so a reader who hovers the
 * symbol in an editor learns where to read.
 *
 * @returns {{symbol: string, tag: string, line: number, pointsAtDoc: boolean}[]}
 */
export function findTaggedSymbols(sourceText) {
    const lines = sourceText.split(/\r?\n/);
    const found = [];
    for (let i = 0; i < lines.length; i++) {
        const tag = Object.keys(KINDS).find((t) => lines[i].includes(t));
        if (!tag) {
            continue;
        }
        // the doc block starts above the tag: walk back to its opening
        let start = i;
        while (start > 0 && !lines[start].includes("/**")) {
            start--;
        }
        // walk forward to the end of the doc block, then to the first line of code after it
        let j = i;
        while (j < lines.length && !lines[j].includes("*/")) {
            j++;
        }
        const block = lines.slice(start, j + 1).join("\n");
        j++;
        while (j < lines.length && isCommentLine(lines[j])) {
            j++;
        }
        if (j >= lines.length) {
            continue;
        }
        const symbol = declaredName(lines[j]);
        if (symbol) {
            found.push({ symbol, tag, line: j + 1, pointsAtDoc: block.includes(DOC) });
        }
    }
    return found;
}

/**
 * What the start-up warnings say about each candidate symbol.
 *
 * A warning is a quoted string that carries the word `experimental`; a doc comment is not one, so
 * a comment continuation line is skipped. `pointsAtDoc` says whether that warning also tells the
 * operator where to read.
 *
 * @returns {Map<string, {pointsAtDoc: boolean}>}
 */
export function findWarnings(sourceText, candidates) {
    const warnings = new Map();
    for (const raw of sourceText.split(/\r?\n/)) {
        const t = raw.trim();
        if (t.startsWith("*") || t.startsWith("//")) {
            continue;
        }
        if (!/["']/.test(t) || !t.toLowerCase().includes("experimental")) {
            continue;
        }
        for (const symbol of candidates) {
            if (!t.includes(symbol)) {
                continue;
            }
            const was = warnings.get(symbol);
            warnings.set(symbol, { pointsAtDoc: (was?.pointsAtDoc ?? false) || t.includes(DOC) });
        }
    }
    return warnings;
}

/**
 * The tables of EXPERIMENTAL.md, one per heading.
 *
 * A row keeps the identifiers of its second cell, which is the prose that says how to turn the
 * feature on, so the rule can check that the cell is actionable rather than merely present.
 *
 * @returns {Map<string, {feature: string, howTo: string, identifiers: string[]}[]>}
 */
export function parseTables(markdown) {
    const bySection = new Map();
    let section = "";
    for (const raw of markdown.split(/\r?\n/)) {
        const t = raw.trim();
        const heading = /^#{2,3}\s+(.*)$/.exec(t);
        if (heading) {
            section = heading[1].trim();
            continue;
        }
        if (!t.startsWith("|") || /^\|[\s|:-]*\|?$/.test(t)) {
            continue;
        }
        const cells = t
            .split("|")
            .slice(1, -1)
            .map((c) => c.trim());
        // a header row registers the section with no rows, so that an empty table is
        // distinguishable from an absent one and gets the precise message
        if (cells.length < 2 || /^how you turn it on$/i.test(cells[1]) || /^feature$/i.test(cells[0])) {
            if (!bySection.has(section)) {
                bySection.set(section, []);
            }
            continue;
        }
        const identifiers = [...cells[1].matchAll(/`([A-Za-z_$][\w$]*)`/g)].map((m) => m[1]);
        const rows = bySection.get(section) ?? [];
        rows.push({ feature: cells[0], howTo: cells[1], identifiers });
        bySection.set(section, rows);
    }
    return bySection;
}

/** Find the table of a kind, whatever heading level or wording case it uses. */
function rowsOfSection(tables, section) {
    for (const [heading, rows] of tables) {
        if (heading.toLowerCase() === section.toLowerCase()) {
            return rows;
        }
    }
    return undefined;
}

/**
 * Everything that disagrees, or that a reader could not act on.
 */
export function compare({ tagged, tables, warnings }) {
    const problems = [];
    const seen = new Set();

    for (const [tag, kind] of Object.entries(KINDS)) {
        const ofKind = tagged.filter((t) => t.tag === tag);
        const rows = rowsOfSection(tables, kind.section);

        if (ofKind.length > 0 && rows === undefined) {
            problems.push(`${DOC} has no "${kind.section}" table, and ${ofKind.length} symbol(s) need it`);
            continue;
        }
        const names = new Set(ofKind.map((t) => t.symbol));

        for (const row of rows ?? []) {
            const hit = row.identifiers.find((id) => names.has(id));
            if (!hit) {
                problems.push(
                    `the row "${row.feature}" under "${kind.section}" names no symbol tagged ${tag}`
                );
                continue;
            }
            seen.add(hit);
            if (row.howTo === "" || row.identifiers.length === 0) {
                problems.push(`the row "${row.feature}" does not say how to turn ${hit} on`);
            }
        }

        for (const t of ofKind) {
            if (!seen.has(t.symbol)) {
                problems.push(`${t.symbol} is tagged ${tag} but no row under "${kind.section}" names it`);
            }
            if (!t.pointsAtDoc) {
                problems.push(`the doc block of ${t.symbol} does not point the reader at ${DOC}`);
            }
            if (!kind.needsWarning) {
                continue;
            }
            const warning = warnings.get(t.symbol);
            if (!warning) {
                problems.push(`${t.symbol} is tagged ${tag} but logs no warning that names it at start`);
            } else if (!warning.pointsAtDoc) {
                problems.push(`the start-up warning of ${t.symbol} does not name ${DOC}`);
            }
        }
    }
    return problems;
}

/**
 * Add a row for each tagged symbol its table does not name, and return the new markdown.
 *
 * It only adds. It never deletes a row, because a row with no matching tag is more often a tag
 * that somebody forgot than a feature that went away, and the prose of a row is hand written. It
 * never edits source either: a missing warning and a missing doc pointer are code, so a human
 * writes them.
 */
export function applyFix(markdown, missing) {
    if (missing.length === 0) {
        return { markdown, added: [] };
    }
    const lines = markdown.split(/\r?\n/);
    const added = [];
    // insert from the bottom up so an earlier splice does not move a later index
    const plan = [];
    for (const { symbol, section } of missing) {
        let heading = -1;
        for (let i = 0; i < lines.length; i++) {
            const h = /^#{2,3}\s+(.*)$/.exec(lines[i].trim());
            if (h && h[1].trim().toLowerCase() === section.toLowerCase()) {
                heading = i;
                break;
            }
        }
        if (heading === -1) {
            return { markdown, added: [], error: `no "${section}" heading` };
        }
        let table = heading;
        while (table < lines.length && !lines[table].trim().startsWith("|")) {
            const h = /^#{2,3}\s+/.exec(lines[table].trim());
            if (h && table !== heading) {
                return { markdown, added: [], error: `no table under "${section}"` };
            }
            table++;
        }
        let end = table + 2; // header, separator, then the rows
        while (end < lines.length && lines[end].trim().startsWith("|")) {
            end++;
        }
        plan.push({ at: end, row: `| ${symbol} | \`${symbol}\` |`, symbol });
    }
    for (const step of plan.sort((a, b) => b.at - a.at)) {
        lines.splice(step.at, 0, step.row);
        added.push(step.symbol);
    }
    return { markdown: lines.join("\n"), added: added.reverse() };
}

function sourceFiles(repoRoot, packageFilter) {
    const packagesDir = path.join(repoRoot, "packages");
    if (!fs.existsSync(packagesDir)) {
        return [];
    }
    const out = [];
    for (const pkg of fs.readdirSync(packagesDir)) {
        if (packageFilter && pkg !== packageFilter) {
            continue;
        }
        const sourceDir = path.join(packagesDir, pkg, "source");
        if (!fs.existsSync(sourceDir)) {
            continue;
        }
        const stack = [sourceDir];
        while (stack.length > 0) {
            const dir = stack.pop();
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name !== "node_modules") {
                        stack.push(full);
                    }
                } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
                    out.push(full);
                }
            }
        }
    }
    return out.sort();
}

export function analyze({ repoRoot = ".", packageFilter, tableFile = DOC } = {}) {
    const files = sourceFiles(repoRoot, packageFilter);
    const tagged = [];
    for (const file of files) {
        const text = fs.readFileSync(file, "utf8");
        if (!Object.keys(KINDS).some((t) => text.includes(t))) {
            continue;
        }
        for (const hit of findTaggedSymbols(text)) {
            tagged.push({ ...hit, file: path.relative(repoRoot, file).split(path.sep).join("/") });
        }
    }

    const candidates = tagged.map((t) => t.symbol);
    const warnings = new Map();
    for (const file of files) {
        for (const [symbol, info] of findWarnings(fs.readFileSync(file, "utf8"), candidates)) {
            const was = warnings.get(symbol);
            warnings.set(symbol, { pointsAtDoc: (was?.pointsAtDoc ?? false) || info.pointsAtDoc });
        }
    }

    const tablePath = path.join(repoRoot, tableFile);
    const tableExists = fs.existsSync(tablePath);
    const tables = tableExists
        ? parseTables(fs.readFileSync(tablePath, "utf8"))
        : new Map();

    const problems = tableExists ? compare({ tagged, tables, warnings }) : [`${tableFile} is missing`];

    const missing = [];
    for (const [tag, kind] of Object.entries(KINDS)) {
        const rows = rowsOfSection(tables, kind.section) ?? [];
        const named = new Set(rows.flatMap((r) => r.identifiers));
        for (const t of tagged.filter((x) => x.tag === tag)) {
            if (!named.has(t.symbol)) {
                missing.push({ symbol: t.symbol, section: kind.section });
            }
        }
    }

    return { tableFile, tableExists, tagged, warnings, problems, missing };
}

export function formatReport(result) {
    const out = [];
    for (const [tag, kind] of Object.entries(KINDS)) {
        const ofKind = result.tagged.filter((t) => t.tag === tag);
        out.push(`${kind.section} (${tag}): ${ofKind.length}`);
        for (const t of ofKind) {
            out.push(`  ${t.symbol}  ${t.file}:${t.line}`);
        }
    }
    for (const p of result.problems) {
        out.push(`ERROR ${p}`);
    }
    if (result.problems.length === 0) {
        out.push(`${result.tableFile}, the doc blocks and the start-up warnings agree with the tags`);
    }
    return out.join("\n");
}

export function exitCode(result) {
    return result.problems.length === 0 ? 0 : 1;
}
