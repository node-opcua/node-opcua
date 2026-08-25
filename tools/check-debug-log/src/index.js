#!/usr/bin/env node
/**
 * check-debug-log - find (and fix) debug log calls that are not guarded by a debug flag.
 *
 * make_debugLog() returns a plain function that tests the debug flag *inside* itself:
 *
 *     function debugLogFunc(...args) {
 *         if (debugFlags[filename] && g_logLevel >= LogLevel.Debug) { ... }
 *     }
 *
 * So a call like
 *
 *     debugLog(`subscription ${id} is ${chalk.bgYellow("NORMAL")}`);
 *
 * builds the template string, runs the chalk chain and allocates a rest-args array on
 * every call, even when debugging is switched off. The cost of any single call is small,
 * but it is paid forever and it grows silently: someone later adds `.toString()` on a
 * per-value path and the line quietly becomes expensive. Guarding uniformly removes the
 * whole class of problem.
 *
 * The convention this tool enforces is the one already used across the repo:
 *
 *     // c8 ignore next
 *     if (doDebug) {
 *         debugLog("...");
 *     }
 *
 * Usage:
 *     node tools/check-debug-log.js                  # report, exit 1 if anything is unguarded
 *     node tools/check-debug-log.js --fix            # rewrite, then report what is left
 *     node tools/check-debug-log.js --package node-opcua-server
 *     node tools/check-debug-log.js --verbose
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const IGNORE_COMMENT = "// c8 ignore next";

/** directories scanned, relative to the repo root */
const SOURCE_ROOTS = ["packages", "packages_extra"];
/** per-package sub-directories that hold shipped source */
const SOURCE_DIRS = ["source", "src"];

// ---------------------------------------------------------------------------------------
// discovery
// ---------------------------------------------------------------------------------------

function findSourceFiles(repoRoot, packageFilter) {
    const files = [];
    for (const root of SOURCE_ROOTS) {
        const rootDir = path.join(repoRoot, root);
        if (!fs.existsSync(rootDir)) {
            continue;
        }
        for (const pkg of fs.readdirSync(rootDir)) {
            if (packageFilter && pkg !== packageFilter) {
                continue;
            }
            for (const sub of SOURCE_DIRS) {
                collect(path.join(rootDir, pkg, sub), files);
            }
        }
    }
    return files;
}

function collect(dir, out) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
        return;
    }
    for (const entry of fs.readdirSync(dir)) {
        if (entry === "node_modules" || entry === "dist") {
            continue;
        }
        const full = path.join(dir, entry);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            collect(full, out);
        } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
            out.push(full);
        }
    }
}

// ---------------------------------------------------------------------------------------
// analysis
// ---------------------------------------------------------------------------------------

/** names bound to make_debugLog(...) in this file, e.g. `const debugLog = make_debugLog(__filename)` */
function findLoggerNames(source) {
    const names = new Set();
    const re = /const\s+(\w+)\s*=\s*make_debugLog\s*\(/g;
    let m;
    while ((m = re.exec(source)) !== null) {
        names.add(m[1]);
    }
    return names;
}

/**
 * name of the file's debug flag, if any.
 *
 * Matches every form in use: `checkDebugFlag(...)`, a hard-coded `= false`, and the
 * parked `_doDebug` variant. Missing one of these and declaring a second flag would
 * produce a redeclaration, so this deliberately accepts any `doDebug`-ish binding.
 */
function findGuardName(source) {
    const byCheck = /const\s+(\w*[dD]oDebug\w*)\s*=\s*checkDebugFlag\s*\(/.exec(source);
    if (byCheck) {
        return byCheck[1];
    }
    const byAny = /const\s+(_?doDebug)\s*=/.exec(source);
    return byAny ? byAny[1] : null;
}

/**
 * true when `lines[i]` continues an expression begun on an earlier line, rather than
 * starting a fresh statement.
 *
 * This is what tells `doDebug &&\n    debugLog(...)` apart from a bare `debugLog(...)`.
 * Wrapping a continuation in an `if` block produces code that does not parse, so anything
 * that is not unambiguously a statement start is left alone.
 */
function continuesPreviousExpression(lines, i) {
    for (let k = i - 1; k >= 0; k--) {
        const prev = lines[k].trim();
        if (prev === "" || isCommentLine(prev)) {
            continue;
        }
        // a statement can only start here if the previous one clearly ended
        return !/[;{}]$/.test(prev) && !prev.endsWith("*/");
    }
    return false;
}

function isCommentLine(trimmed) {
    return trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
}

/**
 * Walk the file tracking brace depth, remembering which open braces belong to an
 * `if (<guard>)`. A logger call is guarded when it sits inside one of those, or carries a
 * `<guard> &&` on its own line.
 *
 * This is deliberately lexical rather than a real parse: it has to run as a pre-commit
 * gate, and every construct it does not understand is reported rather than rewritten.
 */
function findUnguardedStatements(lines, loggerNames, guardName) {
    const guards = guardName ? [guardName, `_${guardName}`, guardName.replace(/^_/, "")] : [];
    const braceIsGuard = [];
    const found = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!isCommentLine(trimmed)) {
            const startsCall = [...loggerNames].some((n) => trimmed.startsWith(`${n}(`));
            if (startsCall && !continuesPreviousExpression(lines, i)) {
                const guardedInline = guards.some((g) => line.includes(`${g} &&`) || line.includes(`${g}&&`));
                const guardedByBlock = braceIsGuard.some(Boolean);
                if (!guardedInline && !guardedByBlock) {
                    const end = findStatementEnd(lines, i);
                    found.push({ start: i, end, indent: line.slice(0, line.length - trimmed.length) });
                }
            }
        }

        // update brace tracking for this line
        const opensGuard = guards.length > 0 && new RegExp(`^\\}?\\s*(else\\s+)?if\\s*\\(\\s*(${guards.join("|")})\\s*\\)`).test(trimmed);
        const opens = countChar(line, "{");
        const closes = countChar(line, "}");
        for (let k = 0; k < opens; k++) {
            braceIsGuard.push(opensGuard && k === 0);
        }
        for (let k = 0; k < closes; k++) {
            braceIsGuard.pop();
        }
    }
    return found;
}

/** a call may span several lines; find the line on which its parentheses balance out */
function findStatementEnd(lines, start) {
    let depth = 0;
    for (let i = start; i < lines.length; i++) {
        depth += countChar(lines[i], "(") - countChar(lines[i], ")");
        if (depth <= 0) {
            return i;
        }
    }
    return start;
}

function countChar(line, ch) {
    // good enough for source that is already formatted by biome; string literals holding
    // braces or parens are reported rather than rewritten because the statement extent
    // would come out wrong and the `--fix` output would not compile
    let n = 0;
    for (const c of line) {
        if (c === ch) {
            n++;
        }
    }
    return n;
}

// ---------------------------------------------------------------------------------------
// fixing
// ---------------------------------------------------------------------------------------

/**
 * consecutive unguarded statements at the same indent are grouped, so they can share a
 * single guard instead of repeating one per line
 */
function groupAdjacent(statements) {
    const groups = [];
    for (const st of statements) {
        const last = groups[groups.length - 1];
        if (last && st.start === last.end + 1 && st.indent === last.indent) {
            last.end = st.end;
            last.count++;
        } else {
            groups.push({ ...st, count: 1 });
        }
    }
    return groups;
}

function ensureGuardDeclaration(source, guardName) {
    if (guardName && !guardName.startsWith("_")) {
        return { source, guardName, added: false };
    }
    if (guardName?.startsWith("_")) {
        // an unused `_doDebug` is already there - promote it rather than adding a second one
        const promoted = guardName.replace(/^_+/, "");
        const re = new RegExp(`\\b${guardName}\\b`, "g");
        return { source: source.replace(re, promoted), guardName: promoted, added: false };
    }
    // no guard at all: declare one next to the logger it protects
    const decl = /^const\s+\w+\s*=\s*make_debugLog\s*\([^)]*\);$/m.exec(source);
    if (!decl) {
        return { source, guardName: null, added: false };
    }
    const arg = /make_debugLog\s*\(([^)]*)\)/.exec(decl[0])[1];
    const insertAt = decl.index + decl[0].length;
    let next = `${source.slice(0, insertAt)}\nconst doDebug = checkDebugFlag(${arg});${source.slice(insertAt)}`;

    if (!/\bcheckDebugFlag\b[^\n]*from "node-opcua-debug"/.test(next)) {
        next = next.replace(/import \{([^}]*)\} from "node-opcua-debug";/, (_all, names) => {
            const list = names
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            list.push("checkDebugFlag");
            list.sort((a, b) => a.localeCompare(b));
            return `import { ${list.join(", ")} } from "node-opcua-debug";`;
        });
    }
    return { source: next, guardName: "doDebug", added: true };
}

function applyFix(source, loggerNames) {
    const ensured = ensureGuardDeclaration(source, findGuardName(source));
    if (!ensured.guardName) {
        return { source, fixed: 0, skipped: true };
    }
    let lines = ensured.source.split("\n");
    const statements = findUnguardedStatements(lines, loggerNames, ensured.guardName);
    const groups = groupAdjacent(statements);

    // bottom-up so earlier line numbers stay valid
    for (const group of groups.reverse()) {
        const original = lines.slice(group.start, group.end + 1);
        let replacement;
        if (group.count === 1) {
            // A lone call reads better inline: an `if` block costs three lines to guard
            // one, and across this repo ~93% of sites are lone calls. The formatter wraps
            // it onto a second line when the result is too long, which is the shape the
            // hand-written guards already have.
            replacement = [`${group.indent}${IGNORE_COMMENT}`, `${group.indent}${ensured.guardName} && ${original[0].trim()}`, ...original.slice(1)];
        } else {
            // Several calls in a row share one guard rather than repeating it per line.
            const body = original.map((l) => (l.trim() ? `    ${l}` : l));
            replacement = [
                `${group.indent}${IGNORE_COMMENT}`,
                `${group.indent}if (${ensured.guardName}) {`,
                ...body,
                `${group.indent}}`
            ];
        }
        // do not stack a second ignore comment on one that is already there
        const above = lines[group.start - 1];
        const from = above !== undefined && above.trim() === IGNORE_COMMENT ? group.start - 1 : group.start;
        lines = [...lines.slice(0, from), ...replacement, ...lines.slice(group.end + 1)];
    }
    return { source: lines.join("\n"), fixed: statements.length, skipped: false, addedGuard: ensured.added };
}

// ---------------------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------------------

function main() {
    const argv = process.argv.slice(2);
    const fix = argv.includes("--fix");
    const verbose = argv.includes("--verbose");
    const pkgIndex = argv.indexOf("--package");
    const packageFilter = pkgIndex >= 0 ? argv[pkgIndex + 1] : null;

    const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..", "..");
    const files = findSourceFiles(repoRoot, packageFilter);

    let totalUnguarded = 0;
    let totalFixed = 0;
    const perPackage = new Map();
    const skipped = [];

    for (const file of files) {
        const source = fs.readFileSync(file, "utf-8");
        if (!source.includes("make_debugLog")) {
            continue;
        }
        const loggerNames = findLoggerNames(source);
        if (loggerNames.size === 0) {
            continue;
        }

        if (fix) {
            const result = applyFix(source, loggerNames);
            if (result.skipped) {
                skipped.push(file);
            } else if (result.fixed > 0) {
                fs.writeFileSync(file, result.source, "utf-8");
                totalFixed += result.fixed;
                if (verbose) {
                    const note = result.addedGuard ? " (added a doDebug declaration)" : "";
                    console.log(`  fixed ${String(result.fixed).padStart(3)}  ${path.relative(repoRoot, file)}${note}`);
                }
            }
            continue;
        }

        const unguarded = findUnguardedStatements(source.split("\n"), loggerNames, findGuardName(source));
        if (unguarded.length === 0) {
            continue;
        }
        totalUnguarded += unguarded.length;
        const pkg = path.relative(repoRoot, file).split(path.sep)[1];
        perPackage.set(pkg, (perPackage.get(pkg) || 0) + unguarded.length);
        if (verbose) {
            for (const st of unguarded) {
                console.log(`  ${path.relative(repoRoot, file)}:${st.start + 1}`);
            }
        }
    }

    if (fix) {
        console.log(`check-debug-log: guarded ${totalFixed} call site${totalFixed === 1 ? "" : "s"}.`);
        if (skipped.length) {
            console.log(`  ${skipped.length} file(s) skipped: no debug flag could be declared automatically.`);
            for (const f of skipped) {
                console.log(`    ${path.relative(repoRoot, f)}`);
            }
        }
        console.log("Run your formatter afterwards - the rewrite does not re-wrap long lines.");
        return 0;
    }

    if (totalUnguarded === 0) {
        console.log("check-debug-log: all debug log calls are guarded.");
        return 0;
    }

    console.log(`check-debug-log: ${totalUnguarded} unguarded debug log call${totalUnguarded === 1 ? "" : "s"}\n`);
    for (const [pkg, count] of [...perPackage.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${String(count).padStart(4)}  ${pkg}`);
    }
    console.log("\nEach of these evaluates its arguments on every call, even with debugging off.");
    console.log("Run with --fix to wrap them, or --verbose to list them.");
    return 1;
}

process.exit(main());
