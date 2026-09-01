/**
 * rule - the debug-logger naming rule, kept pure so the tests can hand it strings.
 *
 * The rule: the logger factories take a stable string literal naming the module, never
 * `__filename` or `__dirname`.
 *
 * Deliberately regex-based rather than parser-based, unlike check-no-tla. This tool
 * REWRITES source, so being conservative beats being clever: it matches only the exact
 * shapes `fn(__filename)`, `fn(__dirname)` and `fn("literal")`, and reports anything
 * else as needing a look rather than guessing at it. A parser would let it rewrite
 * expressions it cannot reason about, which is the wrong risk to take for a --fix. It
 * also keeps the tool dependency-free, so it can be pointed at any project using these
 * helpers.
 */

import fs from "node:fs";
import path from "node:path";
import { SOURCE_ROOTS, shippedDirsOf } from "../../shared/shipped_dirs.mjs";

/** every factory in node-opcua-debug that takes a module name */
export const FACTORIES = ["make_debugLog", "checkDebugFlag", "make_errorLog", "make_warningLog", "make_traceLog", "setDebugFlag"];

/** opt out of the rule on one line, with a reason: `// check-debug-name: ok - why` */
export const IGNORE_MARKER = "check-debug-name: ok";

export { SOURCE_ROOTS };

/**
 * The conventional layout, used only when a package does not say what it publishes.
 * What is actually scanned comes from each package's own `files` - see shipped_dirs.mjs.
 */
export const SOURCE_DIRS = ["source", "src"];

/**
 * Test trees are not published, but they run, and `__filename` does not exist in an ES
 * module. A package that flips takes its own suite down with it, so the rule has to reach
 * here too.
 */
export const TEST_DIRS = ["test", "test_helpers", "test_fixtures"];

/**
 * A scope says which directories to scan. `shipped` means "whatever this package publishes",
 * resolved per package rather than assumed; `extra` is scanned on top of it.
 */
export const SCOPES = {
    source: { shipped: true, extra: [] },
    tests: { shipped: false, extra: TEST_DIRS },
    all: { shipped: true, extra: TEST_DIRS }
};

const SKIP_DIRS = new Set(["node_modules", "dist", "dist-esm", "coverage", "build"]);

/**
 * The module name for a file: mirrors extractBasename() in
 * node-opcua-debug/source/make_loggers.ts, which strips the directory and a trailing
 * .js/.ts. Passing the already-bare result back in is idempotent, which is why the
 * helper needs no change to accept it.
 */
export function moduleNameFor(filePath) {
    return filePath.replace(/(.*[\\|/])?/g, "").replace(/\.(js|ts)$/, "");
}

/** a declaration, not a call: `export function make_debugLog(scriptFullPath: string)` */
function isDeclaration(line, fn) {
    return new RegExp(`function\\s+${fn}\\s*\\(`).test(line);
}

/**
 * Violations in one file's text.
 * Returns [{ line, fn, arg, suggestion, fixable }] with 1-based line numbers.
 */
export function findViolations(text, filePath) {
    const suggestion = moduleNameFor(filePath);
    const lines = text.split("\n");
    const out = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes(IGNORE_MARKER)) {
            continue;
        }
        for (const fn of FACTORIES) {
            if (isDeclaration(line, fn)) {
                continue;
            }
            const global = new RegExp(`\\b${fn}\\(\\s*__(filename|dirname)\\s*\\)`).exec(line);
            if (global) {
                out.push({ line: i + 1, fn, arg: `__${global[1]}`, suggestion, fixable: true, text: line.trim().slice(0, 100) });
                continue;
            }
            // a call that is neither a string literal nor a filename global: report, never rewrite
            const call = new RegExp(`\\b${fn}\\(\\s*([^)]*)\\)`).exec(line);
            if (call && !/^\s*["'`]/.test(call[1]) && call[1].trim() !== "") {
                out.push({ line: i + 1, fn, arg: call[1].trim().slice(0, 40), suggestion, fixable: false, text: line.trim().slice(0, 100) });
            }
        }
    }
    return out;
}

/** rewrite the fixable violations; returns { text, fixed } */
export function fixText(text, filePath) {
    const name = moduleNameFor(filePath);
    let fixed = 0;
    const out = text
        .split("\n")
        .map((line) => {
            if (line.includes(IGNORE_MARKER)) {
                return line;
            }
            let result = line;
            for (const fn of FACTORIES) {
                if (isDeclaration(result, fn)) {
                    continue;
                }
                result = result.replace(new RegExp(`\\b${fn}\\(\\s*__(?:filename|dirname)\\s*\\)`, "g"), () => {
                    fixed++;
                    return `${fn}("${name}")`;
                });
            }
            return result;
        })
        .join("\n");
    return { text: out, fixed };
}

/**
 * Every shipped source file under the given roots. `scope` is a SCOPES descriptor, or a
 * plain array of directory names to scan in every package.
 */
export function findSourceFiles(repoRoot = ".", packageFilter, scope = SCOPES.source) {
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
            const dirs = [
                ...(descriptor.shipped ? shippedDirsOf(pkgDir, SOURCE_DIRS) : []),
                ...(descriptor.extra ?? [])
            ];
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
        } else if (/\.(ts|js|mts|cts|mjs|cjs)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
            out.push(full);
        }
    }
}

/** scan; with { write: true } the fixable violations are rewritten in place */
export function analyze({ repoRoot = ".", packageFilter, write = false, scope = "source" } = {}) {
    const files = findSourceFiles(repoRoot, packageFilter, SCOPES[scope] ?? SCOPES.source);
    const findings = [];
    let fixedCount = 0;
    let fixedFiles = 0;

    for (const file of files) {
        const original = fs.readFileSync(file, "utf8");
        let current = original;
        if (write) {
            const { text, fixed } = fixText(original, file);
            if (fixed > 0) {
                fs.writeFileSync(file, text);
                fixedCount += fixed;
                fixedFiles++;
                current = text;
            }
        }
        for (const v of findViolations(current, file)) {
            findings.push({ file: file.replace(/\\/g, "/"), ...v });
        }
    }
    return { scanned: files.length, findings, fixedCount, fixedFiles };
}

export function exitCode(result) {
    return result.findings.length > 0 ? 1 : 0;
}

export function formatReport(result) {
    const lines = [];
    if (result.fixedFiles > 0) {
        lines.push(`check-debug-name: rewrote ${result.fixedCount} call sites in ${result.fixedFiles} files`, "");
    }
    if (result.findings.length === 0) {
        lines.push(`check-debug-name: ${result.scanned} files scanned, every logger takes a module name.`);
        return lines.join("\n");
    }
    const fixable = result.findings.filter((f) => f.fixable);
    const manual = result.findings.filter((f) => !f.fixable);

    lines.push(`check-debug-name: ${result.findings.length} violations in ${result.scanned} files scanned`, "");
    if (fixable.length) {
        lines.push(`  ${fixable.length} fixable with --fix:`);
        for (const f of fixable) {
            lines.push(`    ${f.file}:${f.line}  ${f.fn}(${f.arg}) -> ${f.fn}("${f.suggestion}")`);
        }
        lines.push("");
    }
    if (manual.length) {
        lines.push(`  ${manual.length} need a look (the argument is not a literal, so it is not rewritten):`);
        for (const f of manual) {
            lines.push(`    ${f.file}:${f.line}  ${f.fn}(${f.arg})`);
        }
        lines.push("");
    }
    lines.push("A logger factory must be given a stable string literal naming the module.");
    lines.push("__filename and __dirname do not exist in ESM or in browser bundles, and the");
    lines.push("value is only ever reduced to a basename anyway, so the literal is what the");
    lines.push("DEBUG env var already matches on.");
    return lines.join("\n");
}
