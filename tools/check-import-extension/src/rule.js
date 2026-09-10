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
import { SOURCE_ROOTS, shippedDirsOf } from "../../shared/shipped_dirs.mjs";
import { TEST_DIRS } from "../../shared/test_dirs.mjs";

/** opt out of the rule on one line, with a reason: `// check-import-extension: ok - why` */
export const IGNORE_MARKER = "check-import-extension: ok";

export { SOURCE_ROOTS };

/**
 * The conventional layout, used only when a package does not say what it publishes.
 * What is actually scanned comes from each package's own `files` - see shipped_dirs.mjs
 * for why this is no longer a constant.
 */
export const SOURCE_DIRS = ["source", "src"];

/**
 * Test trees are not published, but they still have to run, and a file inside a
 * `"type": "module"` package is an ES module whether or not it ships. A package that flips
 * with an extensionless specifier in its own suite breaks its own tests.
 */
export { TEST_DIRS };

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
 * Where a bare deep specifier - `node-opcua-nodeset-ua/dist/ua_folder` - actually points.
 *
 * The rule here is not "add .js". A package that declares `exports` is answered by that map
 * and nothing else: `node-opcua-crypto/web` and `node-opcua-transport/dist/test_helpers` are
 * declared subpaths and stay extensionless, while adding `.js` to either makes them
 * unreachable. Only when a package has no map does resolution fall through to the filesystem,
 * where ESM needs the extension spelled out and has no directory index.
 *
 * Both halves were learned by getting them wrong: a blind rewrite broke 63 crypto imports one
 * way and left a directory import broken the other.
 */
function packageDirOf(name, repoRoot) {
    for (const root of SOURCE_ROOTS) {
        const dir = path.join(repoRoot, root, name);
        if (isFile(path.join(dir, "package.json"))) return dir;
    }
    const dep = path.join(repoRoot, "node_modules", name);
    return isFile(path.join(dep, "package.json")) ? dep : null;
}

/** the subpaths an exports map declares, with `*` patterns kept as patterns */
function exportedSubpaths(manifest) {
    return Object.keys(manifest.exports ?? {}).filter((k) => k.startsWith("./"));
}

const matchesExport = (subpaths, candidate) =>
    subpaths.some((k) => {
        if (!k.includes("*")) return k === candidate;
        const [head, tail] = k.split("*");
        return candidate.startsWith(head) && candidate.endsWith(tail) && candidate.length >= head.length + tail.length;
    });

/** split `@scope/name/sub/path` or `name/sub/path` into [name, sub] */
function splitBare(specifier) {
    const parts = specifier.split("/");
    const take = specifier.startsWith("@") ? 2 : 1;
    if (parts.length <= take) return null; // a bare package import, nothing to resolve
    return [parts.slice(0, take).join("/"), parts.slice(take).join("/")];
}

export function resolveBareSpecifier(specifier, repoRoot = ".") {
    const split = splitBare(specifier);
    if (!split) return { kind: "ok", suggestion: null };
    const [name, sub] = split;
    const dir = packageDirOf(name, repoRoot);
    // a package this checkout cannot see is not something to guess about
    if (!dir) return { kind: "ok", suggestion: null };

    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
    } catch {
        return { kind: "ok", suggestion: null };
    }

    if (manifest.exports) {
        const subpaths = exportedSubpaths(manifest);
        if (matchesExport(subpaths, `./${sub}`)) return { kind: "ok", suggestion: null };
        // the map is authoritative, so an extension here is what breaks it
        const bare = sub.replace(/(\/index)?\.js$/, "");
        if (bare !== sub && matchesExport(subpaths, `./${bare}`)) {
            return { kind: "over-specified", suggestion: `${name}/${bare}` };
        }
        return { kind: "not-exported", suggestion: null };
    }

    // a specifier already carrying an extension is right if the file is there, or if its
    // TypeScript twin is: `source/private/x.js` is the correct ESM form of `x.ts`, which is
    // all that exists in a package whose sources are not emitted in place
    if (SETTLED.test(sub)) {
        const twin = sub.replace(/\.js$/, "");
        const found =
            isFile(path.join(dir, sub)) || [".ts", ".tsx", ".mts", ".cts", ".d.ts"].some((e) => isFile(path.join(dir, twin + e)));
        return found ? { kind: "ok", suggestion: null } : { kind: "unresolved", suggestion: null };
    }
    for (const ext of [".js", ".ts", ".d.ts", ".mjs", ".cjs"]) {
        if (isFile(path.join(dir, sub + ext))) return { kind: "bare-file", suggestion: `${name}/${sub}.js` };
    }
    for (const ext of [".js", ".ts", ".d.ts"]) {
        if (isFile(path.join(dir, sub, `index${ext}`))) return { kind: "bare-directory", suggestion: `${name}/${sub}/index.js` };
    }
    return { kind: "unresolved", suggestion: null };
}

/**
 * Violations in one file's text.
 * Returns [{ line, specifier, kind, suggestion, fixable, text }], 1-based lines.
 */
export function findViolations(text, filePath, repoRoot = ".") {
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
        const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
        if (!isRelative) {
            const { line } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
            if ((lines[line] ?? "").includes(IGNORE_MARKER)) {
                continue;
            }
            const { kind, suggestion } = resolveBareSpecifier(specifier, repoRoot);
            if (kind === "ok") {
                continue;
            }
            out.push({
                line: line + 1,
                specifier,
                kind,
                suggestion,
                fixable: Boolean(suggestion),
                text: (lines[line] ?? "").trim().slice(0, 100)
            });
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
export function fixText(text, filePath, repoRoot = ".") {
    const ext = path.extname(filePath).toLowerCase();
    const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.ESNext, true, SCRIPT_KIND[ext] ?? ts.ScriptKind.TS);
    const lines = text.split("\n");
    const edits = [];

    for (const node of specifierNodes(sourceFile)) {
        const specifier = node.text;
        const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
        if (!isRelative) {
            const { line } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
            if ((lines[line] ?? "").includes(IGNORE_MARKER)) {
                continue;
            }
            const { suggestion } = resolveBareSpecifier(specifier, repoRoot);
            if (suggestion) {
                const start = node.getStart(sourceFile);
                const quote = text[start];
                edits.push({ start, end: node.getEnd(), replacement: `${quote}${suggestion}${quote}` });
            }
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

/**
 * `scope` is a SCOPES descriptor, or a plain array of directory names to scan in every
 * package (which is what the unit tests hand it).
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
        } else if (/\.(ts|tsx|mts|cts)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
            out.push(full);
        }
    }
}

export function analyze({ repoRoot = ".", packageFilter, write = false, scope = "source" } = {}) {
    // note: the CLI defaults to "all"; the library default stays "source" so existing callers
    // and the unit tests keep their narrow scope unless they ask for more.
    const files = findSourceFiles(repoRoot, packageFilter, SCOPES[scope] ?? SCOPES.source);
    const findings = [];
    let fixedCount = 0;
    let fixedFiles = 0;

    for (const file of files) {
        const original = fs.readFileSync(file, "utf8");
        let current = original;
        if (write) {
            const { text, fixed } = fixText(original, file, repoRoot);
            if (fixed > 0) {
                fs.writeFileSync(file, text);
                fixedCount += fixed;
                fixedFiles++;
                current = text;
            }
        }
        for (const v of findViolations(current, file, repoRoot)) {
            findings.push({ file: file.replace(/\\/g, "/"), ...v });
        }
    }
    return { scanned: files.length, findings, fixedCount, fixedFiles, scope };
}

/**
 * Packages whose package-root specifiers cannot be replaced yet, and why. Empty.
 *
 * A specifier is replaced by the entry point its target package names, which works whenever
 * `main` and `types` describe the same thing. node-opcua-address-space was listed here
 * because they did not: the two named different modules exporting different AddressSpace
 * classes. That is fixed, and check-entry-points now fails any package that splits them, so
 * this cannot fill up again without someone noticing.
 */
export const PACKAGE_ROOT_BLOCKED = new Map();

const packageOf = (file) => file.split("/").slice(0, 2).join("/");

/**
 * Every finding gates, except a package-root specifier in a package listed above.
 *
 * Package-root findings were reported without failing while the count stood at 333, because
 * a gate that can never go green is not a gate. 175 of them are gone and the rest sit in one
 * package for a recorded reason, so the gate can hold the line everywhere else. `--fix` still
 * cannot rewrite one: the replacement is a per-package decision, so the report says where to
 * read it from rather than offering a suggestion.
 */
export const isGating = (finding) => finding.kind !== "package-root" || !PACKAGE_ROOT_BLOCKED.has(packageOf(finding.file));

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
        lines.push(`check-import-extension: ${scanned}, every specifier names something ESM can resolve.`);
        // a blocked package is still an open item; saying so is the difference between a
        // gate that has covered everything and one that has been told to look away
        lines.push(...blockedSection(roots));
        return lines.join("\n");
    }
    const fixable = gating.filter((f) => f.fixable);
    // package-root findings are unfixable too, but they get their own section below
    const manual = gating.filter((f) => !f.fixable && f.kind !== "package-root");

    lines.push(`check-import-extension: ${gating.length} specifier(s) ESM cannot resolve, in ${scanned}`, "");
    if (fixable.length) {
        const count = (...kinds) => fixable.filter((f) => kinds.includes(f.kind)).length;
        const parts = [
            `${count("file", "bare-file")} to a file`,
            `${count("directory", "bare-directory")} to a directory index`,
            `${count("over-specified")} over-specified against an exports map`
        ].filter((p) => !p.startsWith("0 "));
        lines.push(`  ${fixable.length} fixable with --fix (${parts.join(", ")}):`);
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
    const gatingRoots = roots.filter(isGating);
    if (gatingRoots.length) {
        lines.push(...rootSection(gatingRoots));
    }
    lines.push(...blockedSection(roots));
    lines.push("");
    lines.push("ESM has no extension search and no directory resolution, so a specifier must");
    lines.push('name the emitted file: "./x.js", or "./x/index.js" when the target is a');
    lines.push("directory. CommonJS tolerates both forms, so this can be fixed now, before any");
    lines.push("package flips.");
    lines.push("");
    lines.push("A package declaring `exports` is the exception: that map is the only thing that");
    lines.push('resolves, so "node-opcua-crypto/web" is already right and adding ".js" to it is');
    lines.push("what would break it.");
    return lines.join("\n");
}

/** the package-root specifiers that are known-blocked, named with the reason they are */
function blockedSection(roots) {
    const out = [];
    for (const [pkg, reason] of PACKAGE_ROOT_BLOCKED) {
        const n = roots.filter((f) => packageOf(f.file) === pkg).length;
        if (n === 0) continue;
        out.push("", `  ${n} import(s) of "." or ".." remain in ${pkg}, which this gate does not fail on:`);
        for (const line of reason.match(/.{1,84}(\s|$)/g) ?? [reason]) {
            out.push(`    ${line.trim()}`);
        }
    }
    return out;
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
    out.push("  for a relative specifier. There is no extension to add, so --fix cannot help.");
    out.push("  Name the entry point that package.json already names: its `types` with the");
    out.push("  .d.ts swapped for .js, falling back to `main`. Prefer `types`, because these");
    out.push("  callers are TypeScript and that is the surface they are checked against - a");
    out.push("  package whose two fields name different facades would otherwise be retyped.");
    out.push("");
    return out;
}
