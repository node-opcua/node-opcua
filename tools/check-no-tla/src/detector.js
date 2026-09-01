/**
 * detector - find module-scope `await` in shipped source.
 *
 * Kept separate from the CLI and free of process/exit so the unit tests can hand it
 * strings and assert on findings, rather than shelling out and matching printed text.
 *
 * Why a real parser and not a regex: the question "is this await at module scope?"
 * is a scope question, not a text question. `(async () => { await x })()` is legal and
 * must not be flagged; `if (c) { await x }` is illegal and must be. Telling those apart
 * with brace counting means reimplementing a parser badly, and a false negative here is
 * invisible - it does not fail the build, it breaks `require()` for every CJS consumer
 * at some later date. TypeScript is already a build dependency, so we use its parser.
 */

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { shippedDirsOf } from "../../shared/shipped_dirs.mjs";

/**
 * Shipped source only: test trees may use whatever they like, they are never required by a
 * consumer. The conventional layout below is a fallback - what is actually scanned comes
 * from each package's own `files`, so a package that ships an unconventionally named tree
 * cannot slip out of coverage unnoticed.
 */
export const SCAN_DIRS = ["source", "src"];

/** directories that never contain shipped source */
const SKIP_DIRS = new Set(["node_modules", "dist", "dist-esm", "coverage", "build", "test", "test_helpers", "test-fixtures"]);

const SCRIPT_KIND = {
    ".ts": ts.ScriptKind.TS,
    ".tsx": ts.ScriptKind.TSX,
    ".mts": ts.ScriptKind.TS,
    ".cts": ts.ScriptKind.TS,
    ".js": ts.ScriptKind.JS,
    ".mjs": ts.ScriptKind.JS,
    ".cjs": ts.ScriptKind.JS,
    ".jsx": ts.ScriptKind.JSX
};

/** true for any node that opens a new function scope, so an await below it is not module-scope */
function opensFunctionScope(node) {
    return (
        ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isConstructorDeclaration(node) ||
        ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node) ||
        ts.isClassStaticBlockDeclaration(node)
    );
}

/**
 * Every module-scope await in one file's text.
 * Returns [{ line, column, kind, text }] with 1-based line numbers.
 */
export function findTopLevelAwait(text, fileName = "input.ts") {
    const ext = path.extname(fileName).toLowerCase();
    const sourceFile = ts.createSourceFile(fileName, text, ts.ScriptTarget.ESNext, true, SCRIPT_KIND[ext] ?? ts.ScriptKind.TS);

    const findings = [];
    const record = (node, kind) => {
        const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
        findings.push({
            line: line + 1,
            column: character + 1,
            kind,
            text: (sourceFile.text.split("\n")[line] ?? "").trim().slice(0, 100)
        });
    };

    const visit = (node, insideFunction) => {
        const nested = insideFunction || opensFunctionScope(node);
        if (!nested) {
            if (ts.isAwaitExpression(node)) {
                record(node, "await");
            } else if (ts.isForOfStatement(node) && node.awaitModifier) {
                record(node, "for await");
            }
        }
        ts.forEachChild(node, (child) => visit(child, nested));
    };
    ts.forEachChild(sourceFile, (child) => visit(child, false));

    return findings;
}

/** every shipped source file under `root`, as paths relative to the process cwd */
export function findSourceFiles(root = "packages") {
    const files = [];
    if (!fs.existsSync(root)) {
        return files;
    }
    for (const pkg of fs.readdirSync(root, { withFileTypes: true })) {
        if (!pkg.isDirectory() || SKIP_DIRS.has(pkg.name)) {
            continue;
        }
        const pkgDir = path.join(root, pkg.name);
        for (const dir of shippedDirsOf(pkgDir, SCAN_DIRS)) {
            walk(path.join(pkgDir, dir), files);
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
        } else if (SCRIPT_KIND[path.extname(entry.name).toLowerCase()] && !entry.name.endsWith(".d.ts")) {
            out.push(full);
        }
    }
}

/** scan a tree; returns { scanned, findings: [{ file, line, column, kind, text }] } */
export function analyze(root = "packages") {
    const findings = [];
    const files = findSourceFiles(root);
    for (const file of files) {
        for (const hit of findTopLevelAwait(fs.readFileSync(file, "utf8"), file)) {
            findings.push({ file: file.replace(/\\/g, "/"), ...hit });
        }
    }
    return { scanned: files.length, findings };
}

export function exitCode(result) {
    return result.findings.length > 0 ? 1 : 0;
}

export function formatReport(result) {
    if (result.findings.length === 0) {
        return `check-no-tla: ${result.scanned} files scanned, no module-scope await.`;
    }
    const lines = [`check-no-tla: ${result.findings.length} module-scope await in ${result.scanned} files scanned`, ""];
    for (const f of result.findings) {
        lines.push(`  ${f.file}:${f.line}:${f.column}  (${f.kind})`);
        lines.push(`      ${f.text}`);
    }
    lines.push("");
    lines.push("Module-scope await makes a package unloadable from require(), which is how");
    lines.push("every CommonJS consumer of node-opcua loads it. Move the await inside an");
    lines.push("async function, or export a factory the caller awaits.");
    return lines.join("\n");
}
