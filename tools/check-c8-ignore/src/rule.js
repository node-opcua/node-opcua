/**
 * rule - a coverage ignore hint written as a line comment, which c8 does not read.
 *
 * c8 recognises the hint only in block-comment form. Its parser (v8-to-istanbul) looks for
 * `/* c8 ignore ... *\/`; a `// c8 ignore next` is just a comment, and the line it was meant
 * to exclude is counted as uncovered like any other.
 *
 * Demonstrated on a three-function fixture where none of the functions is called: the one
 * preceded by the line-comment form is reported uncovered alongside the one with no hint at
 * all, while the block-comment form is excluded. The repository had 963 of the inert spelling
 * across 149 files against 476 working ones, so most of the lines someone had deliberately
 * marked as not-to-count were being counted.
 *
 * Scanner-based, not regex-based: `// c8 ignore` is distinctive, but a bare text substitution
 * would also rewrite it inside a string or a template literal, and this repository documents
 * the convention in its own tooling. The TypeScript scanner tells a comment from a string.
 */

import fs from "node:fs";
import path from "node:path";
// the classic compiler API, which TypeScript 7 no longer exposes: an aliased 5.x copy
import ts from "typescript-5";
import { shippedDirsOf, SOURCE_ROOTS } from "../../shared/shipped_dirs.mjs";
import { TEST_DIRS } from "../../shared/test_dirs.mjs";

export { SOURCE_ROOTS, TEST_DIRS };

/** opt out on one line, with a reason: `// check-c8-ignore: ok - why` */
export const IGNORE_MARKER = "check-c8-ignore: ok";

/** the conventional layout, used only when a package does not say what it publishes */
export const SOURCE_DIRS = ["source", "src"];

/** which directories to scan, mirroring check-cjs-globals */
export const SCOPES = {
    source: { shipped: true, extra: [] },
    tests: { shipped: false, extra: [...TEST_DIRS] },
    all: { shipped: true, extra: [...TEST_DIRS] }
};

const SKIP_DIRS = new Set(["node_modules", "dist", "dist-esm", "coverage", "build"]);

/**
 * A comment that means to be a coverage hint: `c8 ignore ...`, or the same under its older
 * `v8 ignore` name, which c8 still reads.
 */
const HINT = /^(c8|v8)\s+ignore\b\s*(.*)$/;

/**
 * The directives c8 acts on: `next`, `next <count>`, `start`, `stop`. Checked against a
 * fixture in which every spelling guards an uncalled function: `/* c8 ignore *\/` with no
 * directive and `/* c8 ignore end *\/` are both silently inert, the second because the
 * region terminator is spelled `stop`. A directive may carry a trailing reason
 * (`next: why`, `next -- why`, `next 1 : why` all work), so this matches a prefix.
 */
const DIRECTIVE = /^(next(\s+\d+)?|start|stop)\b/;

/** `end` is the one wrong directive with an unambiguous intent, so the only one --fix repairs */
const DIRECTIVE_REPAIR = new Map([["end", "stop"]]);

/**
 * Every single-line comment in `text`, as {start, end, body}. `body` is what follows the
 * `//`, trimmed. The scanner is run with trivia included so comments are visible as tokens.
 */
export function lineComments(text, filePath = "file.ts") {
    const jsx = /\.[jt]sx$/.test(filePath);
    const scanner = ts.createScanner(
        ts.ScriptTarget.Latest,
        /* skipTrivia */ false,
        jsx ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard,
        text
    );
    const out = [];
    let kind = scanner.scan();
    while (kind !== ts.SyntaxKind.EndOfFileToken) {
        const single = kind === ts.SyntaxKind.SingleLineCommentTrivia;
        if (single || kind === ts.SyntaxKind.MultiLineCommentTrivia) {
            const start = scanner.getTokenStart ? scanner.getTokenStart() : scanner.getTokenPos();
            const end = scanner.getTextPos();
            const raw = text.slice(start, end);
            // a /** ... */ block spanning lines is prose, not a hint: only a single-line
            // block comment can be one, and that is the only shape c8 itself reads
            if (single || !raw.includes("\n")) {
                const body = single ? raw.replace(/^\/\/\s*/, "") : raw.replace(/^\/\*+\s*/, "").replace(/\s*\*\/$/, "");
                out.push({ start, end, block: !single, body: body.trimEnd() });
            }
        }
        kind = scanner.scan();
    }
    return out;
}

/** the hint a comment carries, or undefined: {directive, valid, repair} */
function hintOf(comment) {
    const m = HINT.exec(comment.body);
    if (!m) {
        return undefined;
    }
    const directive = m[2].trim();
    return { directive, valid: DIRECTIVE.test(directive), repair: DIRECTIVE_REPAIR.get(directive) };
}

const lineOf = (text, index) => text.slice(0, index).split(/\r?\n/).length;

/** the coverage hints c8 will not act on: written as a line comment, or misspelled */
export function findViolations(text, filePath = "file.ts") {
    const lines = text.split(/\r?\n/);
    const out = [];
    for (const comment of lineComments(text, filePath)) {
        const hint = hintOf(comment);
        if (!hint || (comment.block && hint.valid)) {
            continue;
        }
        const line = lineOf(text, comment.start);
        const reason = !hint.valid
            ? `"${hint.directive || "(no directive)"}" is not one of next, next <n>, start, stop`
            : "a line comment is not read by c8";
        out.push({
            line,
            text: comment.block ? `/* ${comment.body} */` : `// ${comment.body}`,
            reason,
            // a hint whose text already holds a comment terminator cannot become a block comment
            fixable: (hint.valid || hint.repair !== undefined) && !comment.body.includes("*/"),
            ignored: lines[line - 1]?.includes(IGNORE_MARKER) ?? false
        });
    }
    return out;
}

/** rewrite every fixable hint in `text` to the block-comment form c8 reads */
export function fixText(text, filePath = "file.ts") {
    const lines = text.split(/\r?\n/);
    const targets = [];
    for (const comment of lineComments(text, filePath)) {
        const hint = hintOf(comment);
        if (!hint || (comment.block && hint.valid) || comment.body.includes("*/")) {
            continue;
        }
        if (!hint.valid && hint.repair === undefined) {
            continue;
        }
        if (lines[lineOf(text, comment.start) - 1]?.includes(IGNORE_MARKER)) {
            continue;
        }
        targets.push({ comment, hint });
    }
    if (targets.length === 0) {
        return { text, fixed: 0 };
    }
    let out = text;
    // back to front, so an earlier replacement does not move a later offset
    for (const { comment, hint } of targets.reverse()) {
        const body = hint.repair ? comment.body.replace(/\S+\s*$/, hint.repair) : comment.body;
        out = `${out.slice(0, comment.start)}/* ${body} */${out.slice(comment.end)}`;
    }
    return { text: out, fixed: targets.length };
}

export function findSourceFiles(repoRoot = ".", packageFilter, scope = SCOPES.all) {
    const descriptor = Array.isArray(scope) ? { shipped: false, extra: scope } : scope;
    const files = [];
    for (const root of SOURCE_ROOTS) {
        const full = path.join(repoRoot, root);
        if (!fs.existsSync(full)) {
            continue;
        }
        for (const pkg of fs.readdirSync(full, { withFileTypes: true })) {
            if (!pkg.isDirectory() || SKIP_DIRS.has(pkg.name)) {
                continue;
            }
            if (packageFilter && pkg.name !== packageFilter) {
                continue;
            }
            const pkgDir = path.join(full, pkg.name);
            const dirs = [...(descriptor.shipped ? shippedDirsOf(pkgDir, SOURCE_DIRS) : []), ...(descriptor.extra ?? [])];
            for (const dir of new Set(dirs)) {
                walk(path.join(pkgDir, dir), files);
            }
        }
    }
    return files;
}

function walk(dir, out) {
    if (!fs.existsSync(dir)) {
        return;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) {
                walk(full, out);
            }
        } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
            out.push(full);
        }
    }
}

export function analyze({ repoRoot = ".", packageFilter, write = false, scope = "all" } = {}) {
    const files = findSourceFiles(repoRoot, packageFilter, SCOPES[scope] ?? SCOPES.all);
    const findings = [];
    let exempt = 0;
    let fixedCount = 0;
    let fixedFiles = 0;

    for (const file of files) {
        let current = fs.readFileSync(file, "utf8");
        if (!current.includes("ignore")) {
            continue;
        }
        if (write) {
            const { text, fixed } = fixText(current, file);
            if (fixed > 0) {
                fs.writeFileSync(file, text);
                fixedCount += fixed;
                fixedFiles++;
                current = text;
            }
        }
        for (const v of findViolations(current, file)) {
            if (v.ignored) {
                exempt++;
            } else {
                findings.push({ file: file.replace(/\\/g, "/"), ...v });
            }
        }
    }
    return { scanned: files.length, findings, exempt, fixedCount, fixedFiles, scope };
}

export function exitCode(result) {
    return result.findings.length > 0 ? 1 : 0;
}

export function formatReport(result) {
    const lines = [];
    if (result.fixedFiles > 0) {
        lines.push(`check-c8-ignore: rewrote ${result.fixedCount} hint(s) in ${result.fixedFiles} files`, "");
    }
    const exemptNote = result.exempt > 0 ? `, ${result.exempt} exempted` : "";
    if (result.findings.length === 0) {
        lines.push(`check-c8-ignore: ${result.scanned} files scanned${exemptNote}, every coverage hint is a block comment.`);
        return lines.join("\n");
    }
    lines.push(
        `check-c8-ignore: ${result.findings.length} coverage hint(s) c8 cannot read, in ${result.scanned} files scanned${exemptNote}`,
        ""
    );
    for (const f of result.findings) {
        lines.push(`    ${f.file}:${f.line}  ${f.text}${f.fixable ? "" : "   (fix by hand)"}`);
        lines.push(`        ${f.reason}`);
    }
    lines.push(
        "",
        "c8 acts on a hint only as a single-line block comment carrying one of next,",
        "next <n>, start or stop. Anything else is an ordinary comment, and the line it was",
        "meant to exclude is counted as uncovered.",
        "",
        "    // c8 ignore next        does nothing",
        "    /* c8 ignore */          does nothing, no directive",
        "    /* c8 ignore end */      does nothing, the terminator is spelled stop",
        "    /* c8 ignore next */     excludes the next line",
        "    /* c8 ignore next 2 */   excludes the next two lines",
        "    /* c8 ignore start */ .. /* c8 ignore stop */   excludes a region",
        "",
        "`node tools/check-c8-ignore.mjs --fix` rewrites them. A one-off exception takes",
        `// ${IGNORE_MARKER} - why`
    );
    return lines.join("\n");
}
