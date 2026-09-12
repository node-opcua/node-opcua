/**
 * rule - shipped source reaches its own location through one named anchor, not `__dirname`
 * scattered through the code.
 *
 * `__dirname` and `__filename` do not exist in an ES module, and they do not exist in a
 * browser bundle either. FEAT-1 converted the ~19 real path uses to a single line per module:
 *
 *     // The one place this module learns where it sits on disk. `import.meta.dirname`
 *     // cannot be used while this package emits CommonJS (TS1470), so the ESM migration
 *     // has this single line to change rather than several scattered uses.
 *     const here = __dirname;
 *
 * The point is not style. It is that each module then has exactly one line to change at the
 * flip, and that line is findable. FEAT-1 asserted the tree was clean afterwards, nothing
 * gated it, and by the time the migration resumed four more raw uses had appeared - two of
 * them in packages written after FEAT-1 closed.
 *
 * `check-debug-name` covers only `make_debugLog(__filename)`, the logger-factory case. This
 * covers path resolution, which is the half that actually has to change.
 *
 * Parser-based rather than regex-based: `__dirname` appears in comments all over this
 * repository, including in the very comment quoted above, and a regex cannot tell those from
 * code without reimplementing a tokenizer.
 */

import fs from "node:fs";
import path from "node:path";
// the classic compiler API, which TypeScript 7 no longer exposes: an aliased 5.x copy
import ts from "typescript-5";
import { shippedDirsOf, SOURCE_ROOTS } from "../../shared/shipped_dirs.mjs";

export { SOURCE_ROOTS };

/** opt out on one line, with a reason: `// check-dirname: ok - why` */
export const IGNORE_MARKER = "check-dirname: ok";

/** the conventional layout, used only when a package does not say what it publishes */
export const SOURCE_DIRS = ["source", "src"];

const SKIP_DIRS = new Set(["node_modules", "dist", "dist-esm", "coverage", "build"]);

/**
 * The anchor this rule exists to encourage: `const <name> = __dirname;` at module scope.
 * Anything else that mentions the global in code is a finding.
 */
function isAnchorDeclaration(node) {
    if (!ts.isVariableDeclaration(node.parent)) {
        return false;
    }
    if (node.parent.initializer !== node) {
        return false;
    }
    // module scope only: an anchor inside a function is not the one-line-to-change pattern
    const statement = node.parent.parent?.parent;
    return statement !== undefined && ts.isSourceFile(statement.parent);
}

/**
 * A guarded use, which is already ESM-safe and browser-safe:
 *     typeof __filename === "undefined" ? "<browser>" : __filename
 * Recognised by the presence of a `typeof __filename ===` test anywhere in the file, which is
 * narrow enough: a file that bothers to guard is not the problem this rule is looking for.
 */
function hasTypeofGuard(text, name) {
    return new RegExp(`typeof\\s+${name}\\s*[=!]==`).test(text);
}

/** Violations in one file's text, as [{ line, name, text, ignored }]. */
export function findViolations(text, filePath = "file.ts") {
    if (!text.includes("__dirname") && !text.includes("__filename")) {
        return [];
    }
    const sf = ts.createSourceFile(filePath, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
    const lines = text.split("\n");
    const out = [];

    const visit = (node) => {
        if (ts.isIdentifier(node) && (node.text === "__dirname" || node.text === "__filename")) {
            // a property named __dirname is not the global: obj.__dirname
            const isProperty = ts.isPropertyAccessExpression(node.parent) && node.parent.name === node;
            if (!isProperty && !isAnchorDeclaration(node) && !hasTypeofGuard(text, node.text)) {
                const { line } = ts.getLineAndCharacterOfPosition(sf, node.getStart(sf));
                out.push({
                    line: line + 1,
                    name: node.text,
                    text: (lines[line] ?? "").trim().slice(0, 100),
                    ignored: (lines[line] ?? "").includes(IGNORE_MARKER)
                });
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return out;
}

/** every shipped source file, from what each package says it publishes */
export function findSourceFiles(repoRoot = ".", packageFilter) {
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
            for (const dir of shippedDirsOf(pkgDir, SOURCE_DIRS)) {
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
        } else if (/\.(ts|mts|cts)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
            out.push(full);
        }
    }
}

export function analyze({ repoRoot = ".", packageFilter } = {}) {
    const files = findSourceFiles(repoRoot, packageFilter);
    const findings = [];
    let exempt = 0;

    for (const file of files) {
        const text = fs.readFileSync(file, "utf8");
        for (const v of findViolations(text, file)) {
            if (v.ignored) {
                exempt++;
            } else {
                findings.push({ file: file.replace(/\\/g, "/"), ...v });
            }
        }
    }
    return { scanned: files.length, findings, exempt };
}

export function exitCode(result) {
    return result.findings.length > 0 ? 1 : 0;
}

export function formatReport(result) {
    const exemptNote = result.exempt > 0 ? `, ${result.exempt} exempted` : "";
    if (result.findings.length === 0) {
        return `check-dirname: ${result.scanned} files scanned${exemptNote}, every module reaches its own location through one anchor.`;
    }
    const lines = [
        `check-dirname: ${result.findings.length} raw use(s) of __dirname/__filename, in ${result.scanned} files scanned${exemptNote}`,
        ""
    ];
    for (const f of result.findings) {
        lines.push(`    ${f.file}:${f.line}  ${f.text}`);
    }
    lines.push(
        "",
        "Neither global exists in an ES module or a browser bundle. Give the module one",
        "anchor at module scope and use that:",
        "",
        "    // The one place this module learns where it sits on disk. `import.meta.dirname`",
        "    // cannot be used while this package emits CommonJS (TS1470), so the ESM migration",
        "    // has this single line to change rather than several scattered uses.",
        "    const here = __dirname;",
        "",
        `A deliberate exception - a browser guard, say - takes // ${IGNORE_MARKER} - why`
    );
    return lines.join("\n");
}
