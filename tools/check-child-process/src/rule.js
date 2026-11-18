/**
 * rule - shipped source does not run a child process through a shell.
 *
 * `exec` and `execSync` always start a shell, so any text that reaches them is parsed as
 * shell syntax. `spawn`, `spawnSync`, `execFile`, `execFileSync` and `fork` start a shell only
 * when the options object carries a `shell` property that is not `false`.
 *
 * Parser-based rather than regex-based: `.exec(` is overwhelmingly `RegExp.prototype.exec`
 * (or a database handle), and only a call that resolves to an import of `child_process`
 * is the problem.
 *
 * A deliberate exception takes `// check-child-process: ok - <reason>` on the call line or
 * on the `shell:` property line.
 */

import fs from "node:fs";
import path from "node:path";
// the classic compiler API, which TypeScript 7 no longer exposes: an aliased 5.x copy
import ts from "typescript-5";
import { shippedDirsOf, SOURCE_ROOTS } from "../../shared/shipped_dirs.mjs";

/** standalone scripts that Node runs directly: not published, but they still run on users' machines */
const BIN_DIRS = ["bin"];

export { SOURCE_ROOTS };

/** opt out on one line, with a reason: `// check-child-process: ok - why` */
export const IGNORE_MARKER = "check-child-process: ok";

/** the conventional layout, used only when a package does not say what it publishes */
export const SOURCE_DIRS = ["source", "src"];

const SKIP_DIRS = new Set(["node_modules", "dist", "dist-esm", "coverage", "build"]);

const MODULES = new Set(["child_process", "node:child_process"]);
/** always use a shell */
const ALWAYS_SHELL = new Set(["exec", "execSync"]);
/** use a shell only when `shell` is set */
const OPTIONAL_SHELL = new Set(["spawn", "spawnSync", "execFile", "execFileSync", "fork"]);

export const HINT =
    "build an argument list and call execFile/spawn without a shell; " +
    `if a shell is truly needed, add \`// ${IGNORE_MARKER} - <reason>\``;

/** the string of a require("...") call, or undefined */
function requireTarget(node) {
    if (
        node &&
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "require" &&
        node.arguments.length === 1 &&
        ts.isStringLiteralLike(node.arguments[0])
    ) {
        return node.arguments[0].text;
    }
    return undefined;
}

/**
 * What this file bound from child_process:
 *   functions:  local name -> exported name   (import { exec as run }, const { exec } = require(...))
 *   namespaces: local names standing for the whole module (import cp, import * as cp, const cp = require(...))
 */
function collectBindings(sf) {
    const functions = new Map();
    const namespaces = new Set();

    const visit = (node) => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && MODULES.has(node.moduleSpecifier.text)) {
            const clause = node.importClause;
            if (clause?.name) {
                namespaces.add(clause.name.text);
            }
            const nb = clause?.namedBindings;
            if (nb && ts.isNamespaceImport(nb)) {
                namespaces.add(nb.name.text);
            } else if (nb && ts.isNamedImports(nb)) {
                for (const el of nb.elements) {
                    functions.set(el.name.text, (el.propertyName ?? el.name).text);
                }
            }
        } else if (ts.isImportEqualsDeclaration(node)) {
            // import cp = require("child_process")
            const ref = node.moduleReference;
            if (ts.isExternalModuleReference(ref) && ts.isStringLiteral(ref.expression) && MODULES.has(ref.expression.text)) {
                namespaces.add(node.name.text);
            }
        } else if (ts.isVariableDeclaration(node) && MODULES.has(requireTarget(node.initializer))) {
            if (ts.isIdentifier(node.name)) {
                namespaces.add(node.name.text);
            } else if (ts.isObjectBindingPattern(node.name)) {
                for (const el of node.name.elements) {
                    if (ts.isIdentifier(el.name)) {
                        const exported = el.propertyName && ts.isIdentifier(el.propertyName) ? el.propertyName.text : el.name.text;
                        functions.set(el.name.text, exported);
                    }
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return { functions, namespaces };
}

/** the exported child_process function this call resolves to, or undefined */
function resolveCallee(call, bindings) {
    const callee = call.expression;
    if (ts.isIdentifier(callee)) {
        return bindings.functions.get(callee.text);
    }
    if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && bindings.namespaces.has(callee.expression.text)) {
        return callee.name.text;
    }
    return undefined;
}

/** the `shell` property of an object-literal argument whose value is not the keyword `false`, or undefined */
function shellProperty(call) {
    for (const arg of call.arguments) {
        if (!ts.isObjectLiteralExpression(arg)) {
            continue;
        }
        for (const prop of arg.properties) {
            const name = prop.name;
            const isShell = name && (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) && name.text === "shell";
            if (!isShell) {
                continue;
            }
            if (ts.isPropertyAssignment(prop) && prop.initializer.kind === ts.SyntaxKind.FalseKeyword) {
                continue;
            }
            return prop;
        }
    }
    return undefined;
}

/** Violations in one file's text, as [{ line, name, text, ignored, hint }]. */
export function findViolations(text, filePath = "file.ts") {
    if (!text.includes("child_process")) {
        return [];
    }
    const sf = ts.createSourceFile(filePath, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
    const bindings = collectBindings(sf);
    if (bindings.functions.size === 0 && bindings.namespaces.size === 0) {
        return [];
    }
    const lines = text.split("\n");
    const lineOf = (pos) => ts.getLineAndCharacterOfPosition(sf, pos).line;
    const marked = (n) => (lines[n] ?? "").includes(IGNORE_MARKER);
    const out = [];

    const visit = (node) => {
        if (ts.isCallExpression(node)) {
            const name = resolveCallee(node, bindings);
            let propLine;
            let found = false;
            if (name !== undefined && ALWAYS_SHELL.has(name)) {
                found = true;
            } else if (name !== undefined && OPTIONAL_SHELL.has(name)) {
                const prop = shellProperty(node);
                if (prop) {
                    found = true;
                    propLine = lineOf(prop.getStart(sf));
                }
            }
            if (found) {
                const line = lineOf(node.getStart(sf));
                out.push({
                    line: line + 1,
                    name,
                    text: (lines[line] ?? "").trim().slice(0, 100),
                    ignored: marked(line) || (propLine !== undefined && marked(propLine)),
                    hint: HINT
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
            for (const dir of [...shippedDirsOf(pkgDir, SOURCE_DIRS), ...BIN_DIRS]) {
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
        return `check-child-process: ${result.scanned} files scanned${exemptNote}, no child process runs through a shell.`;
    }
    const lines = [
        `check-child-process: ${result.findings.length} child process call(s) through a shell, in ${result.scanned} files scanned${exemptNote}`,
        ""
    ];
    for (const f of result.findings) {
        lines.push(`    ${f.file}:${f.line}  ${f.text}`);
    }
    lines.push("", HINT);
    return lines.join("\n");
}
