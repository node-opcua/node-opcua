/**
 * rule - relative module specifiers must carry the extension ESM will need.
 *
 * ESM has no extension search and no directory resolution: `./foo` and `./foo/` both
 * fail, where CommonJS would have found `foo.js` or `foo/index.js`. TypeScript's NodeNext
 * accepts the extensionless form while a package emits CommonJS, which is why 4900 of
 * them accumulated, and rejects it the moment the package becomes "type": "module".
 *
 * Writing them now is safe and already proven in this repo: nine CommonJS packages
 * carry ~96 specifiers with an explicit `.js` today and build green.
 *
 * Parser-based, unlike check-debug-name, and the reason is specific to this rule. A
 * module specifier is a string, and this repo contains code generators whose *output*
 * includes import statements, so `from "./${filename}"` appears inside template
 * literals. A regex cannot tell a real ImportDeclaration from a string that looks like
 * one, and with ~4900 rewrites a single false positive would silently corrupt generator
 * output. The parser gives exact specifier nodes and cannot make that mistake.
 */

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

/** opt out of the rule on one line, with a reason: `// check-import-extension: ok - why` */
export const IGNORE_MARKER = "check-import-extension: ok";

export const SOURCE_ROOTS = ["packages", "packages_extra"];
export const SOURCE_DIRS = ["source", "src"];

/**
 * Test trees are not published, but they still have to run, and a file inside a
 * `"type": "module"` package is an ES module whether or not it ships. A package that flips
 * with an extensionless specifier in its own suite breaks its own tests.
 */
export const TEST_DIRS = ["test", "test_helpers", "test_fixtures"];

export const SCOPES = {
    source: SOURCE_DIRS,
    tests: TEST_DIRS,
    all: [...SOURCE_DIRS, ...TEST_DIRS]
};

const SKIP_DIRS = new Set(["node_modules", "dist", "dist-esm", "coverage", "build"]);

/** extensions a specifier may already end with, in which case it is left alone */
const SETTLED = /\.(js|mjs|cjs|json|node|css)$/;

/** pure traversal with no filename: ".", "..", "../..", "../../.." */
const PACKAGE_ROOT = /^\.{1,2}(\/\.\.)*\/?$/;

const SCRIPT_KIND = { ".ts": ts.ScriptKind.TS, ".tsx": ts.ScriptKind.TSX, ".mts": ts.ScriptKind.TS, ".cts": ts.ScriptKind.TS };

/** every string literal that is genuinely a module specifier */
function specifierNodes(sourceFile) {
    const out = [];
    const visit = (node) => {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
            out.push(node.moduleSpecifier);
        } else if (
            ts.isCallExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ImportKeyword &&
            node.arguments.length > 0 &&
            ts.isStringLiteral(node.arguments[0])
        ) {
            out.push(node.arguments[0]);
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);
    return out;
}

const isFile = (p) => {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
};

/**
 * What a relative specifier should become, resolved against the filesystem.
 * Returns { kind: "file" | "directory" | "unresolved", suggestion }.
 *
 * The distinction matters: `./private` is a directory and must become
 * `./private/index.js`, not `./private.js`.
 */
export function resolveSpecifier(fromFile, specifier) {
    const base = path.posix.join(path.posix.dirname(fromFile.replace(/\\/g, "/")), specifier);
    for (const ext of [".ts", ".tsx", ".mts", ".cts"]) {
        if (isFile(base + ext)) {
            return { kind: "file", suggestion: `${specifier}.js` };
        }
    }
    if (isFile(`${base}.js`)) {
        return { kind: "file", suggestion: `${specifier}.js` };
    }
    for (const ext of [".ts", ".tsx", ".js"]) {
        if (isFile(path.posix.join(base, `index${ext}`))) {
            return { kind: "directory", suggestion: `${specifier.replace(/\/$/, "")}/index.js` };
        }
    }
    return { kind: "unresolved", suggestion: null };
}

/**
 * Violations in one file's text.
 * Returns [{ line, specifier, kind, suggestion, fixable, text }], 1-based lines.
 */
export function findViolations(text, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.ESNext, true, SCRIPT_KIND[ext] ?? ts.ScriptKind.TS);
    const lines = text.split("\n");
    const out = [];

    for (const node of specifierNodes(sourceFile)) {
        const specifier = node.text;
        // A specifier made only of traversal - ".", "..", "../.." - names a directory and
        // carries no filename, so it resolves only through that directory's package.json,
        // which NodeNext does not do for a relative specifier. There is no extension to
        // add, so this rule cannot fix them; they are counted and reported rather than
        // passed over in silence, because a gate that quietly ignores a case reads as if
        // it had checked it.
        if (PACKAGE_ROOT.test(specifier)) {
            const { line } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
            out.push({
                line: line + 1,
                specifier,
                kind: "package-root",
                suggestion: null,
                fixable: false,
                text: (lines[line] ?? "").trim().slice(0, 100)
            });
            continue;
        }
        if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
            continue;
        }
        if (SETTLED.test(specifier)) {
            continue;
        }
        const { line } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
        if ((lines[line] ?? "").includes(IGNORE_MARKER)) {
            continue;
        }
        const { kind, suggestion } = resolveSpecifier(filePath, specifier);
        out.push({
            line: line + 1,
            specifier,
            kind,
            suggestion,
            fixable: kind !== "unresolved",
            text: (lines[line] ?? "").trim().slice(0, 100)
        });
    }
    return out;
}

/** rewrite the fixable specifiers; returns { text, fixed } */
export function fixText(text, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.ESNext, true, SCRIPT_KIND[ext] ?? ts.ScriptKind.TS);
    const lines = text.split("\n");
    const edits = [];

    for (const node of specifierNodes(sourceFile)) {
        const specifier = node.text;
        if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
            continue;
        }
        if (SETTLED.test(specifier)) {
            continue;
        }
        const { line } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
        if ((lines[line] ?? "").includes(IGNORE_MARKER)) {
            continue;
        }
        const { suggestion } = resolveSpecifier(filePath, specifier);
        if (!suggestion) {
            continue;
        }
        // replace the literal including its quotes, preserving which quote was used
        const start = node.getStart(sourceFile);
        const end = node.getEnd();
        const quote = text[start];
        edits.push({ start, end, replacement: `${quote}${suggestion}${quote}` });
    }

    // apply back to front so earlier offsets stay valid
    edits.sort((a, b) => b.start - a.start);
    let out = text;
    for (const e of edits) {
        out = out.slice(0, e.start) + e.replacement + out.slice(e.end);
    }
    return { text: out, fixed: edits.length };
}

export function findSourceFiles(repoRoot = ".", packageFilter, dirs = SOURCE_DIRS) {
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
            for (const dir of dirs) {
                walk(path.join(full, pkg.name, dir), files);
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
        } else if (/\.(ts|tsx|mts|cts)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
            out.push(full);
        }
    }
}

export function analyze({ repoRoot = ".", packageFilter, write = false, scope = "source" } = {}) {
    // note: the CLI defaults to "all"; the library default stays "source" so existing callers
    // and the unit tests keep their narrow scope unless they ask for more.
    const dirs = SCOPES[scope] ?? SOURCE_DIRS;
    const files = findSourceFiles(repoRoot, packageFilter, dirs);
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
    return { scanned: files.length, findings, fixedCount, fixedFiles, scope };
}

/**
 * A package-root specifier is a real problem for ESM, but not one this rule can express a
 * fix for, and it is tracked separately. Failing on it here would mean the gate could never
 * go green, so it is reported and excluded from the exit code.
 */
export const isGating = (finding) => finding.kind !== "package-root";

export function exitCode(result) {
    return result.findings.some(isGating) ? 1 : 0;
}

export function formatReport(result) {
    const lines = [];
    if (result.fixedFiles > 0) {
        lines.push(`check-import-extension: rewrote ${result.fixedCount} specifiers in ${result.fixedFiles} files`, "");
    }
    const scope = result.scope ?? "source";
    const roots = result.findings.filter((f) => f.kind === "package-root");
    const gating = result.findings.filter(isGating);

    // always say what was covered: a count with no scope reads as if it covered everything
    const covered = { source: "source files", tests: "test files", all: "files scanned across source and test trees" };
    const scanned = `${result.scanned} ${covered[scope] ?? `${scope} files`}${scope === "all" ? "" : " scanned"}`;

    if (gating.length === 0) {
        lines.push(`check-import-extension: ${scanned}, every relative specifier carries its extension.`);
        if (roots.length) {
            lines.push(`  (${roots.length} import(s) of "." or ".." are reported below but do not fail this gate)`);
            lines.push(...rootSection(roots));
        }
        return lines.join("\n");
    }
    const fixable = gating.filter((f) => f.fixable);
    const manual = gating.filter((f) => !f.fixable);

    lines.push(`check-import-extension: ${gating.length} specifiers without an extension, in ${scanned}`, "");
    if (fixable.length) {
        const dirs = fixable.filter((f) => f.kind === "directory").length;
        lines.push(`  ${fixable.length} fixable with --fix (${fixable.length - dirs} to a file, ${dirs} to a directory index):`);
        for (const f of fixable.slice(0, 40)) {
            lines.push(`    ${f.file}:${f.line}  "${f.specifier}" -> "${f.suggestion}"`);
        }
        if (fixable.length > 40) {
            lines.push(`    ... and ${fixable.length - 40} more`);
        }
        lines.push("");
    }
    if (manual.length) {
        lines.push(`  ${manual.length} could not be resolved on disk and are never rewritten:`);
        for (const f of manual) {
            lines.push(`    ${f.file}:${f.line}  "${f.specifier}"`);
        }
        lines.push("");
    }
    if (roots.length) {
        lines.push(...rootSection(roots));
    }
    lines.push("ESM has no extension search and no directory resolution, so a relative");
    lines.push('specifier must name the emitted file: "./x.js", or "./x/index.js" when the');
    lines.push("target is a directory. CommonJS tolerates both forms, so this can be fixed");
    lines.push("now, before any package flips.");
    return lines.join("\n");
}

/** the `.` / `..` specifiers, listed by package so the scale is visible */
function rootSection(roots) {
    const byPackage = new Map();
    for (const f of roots) {
        const pkg = f.file.split("/").slice(0, 2).join("/");
        byPackage.set(pkg, (byPackage.get(pkg) ?? 0) + 1);
    }
    const out = ["", `  ${roots.length} import(s) of "." or "..", which name a directory:`];
    for (const [pkg, n] of [...byPackage].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
        out.push(`    ${String(n).padStart(4)}  ${pkg}`);
    }
    if (byPackage.size > 10) {
        out.push(`    ... and ${byPackage.size - 10} more package(s)`);
    }
    out.push("  A directory resolves only through its package.json, which NodeNext does not do");
    out.push("  for a relative specifier. There is no extension to add, so --fix cannot help:");
    out.push("  these need an explicit entry point, tracked separately.");
    out.push("");
    return out;
}
