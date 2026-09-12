/**
 * rule - a CommonJS-only global used as a value in a file that is an ES module.
 *
 * All 122 packages in this workspace declare `"type": "module"`. A `.ts` or `.js` file
 * inside one of them is an ES module, where `require`, `module` and `exports` simply do
 * not exist. Two files still contained `if (require.main === module)`, the CommonJS "was
 * I run directly?" idiom. That failed at *import* time, not when the branch ran, so a
 * test importing one of those files for its exports crashed on the reference alone.
 * Nothing caught it until the test loader moved to real ESM (FEAT-4), and even then only
 * the `build_per_package` CI job saw it.
 *
 * Parser-based, not regex-based, for the same reason `check-dirname` is: `require`,
 * `module` and `exports` are common English/JS words that appear in comments and strings
 * throughout this repository, and a `require` bound by `createRequire(import.meta.url)`
 * (the repo's deliberate synchronous-require form) or a parameter merely named `module`
 * must not be flagged. Telling those apart needs the AST and a scope walk, not a regex.
 */

import fs from "node:fs";
import path from "node:path";
// the classic compiler API, which TypeScript 7 no longer exposes: an aliased 5.x copy
import ts from "typescript-5";
import { shippedDirsOf, SOURCE_ROOTS } from "../../shared/shipped_dirs.mjs";
import { TEST_DIRS } from "../../shared/test_dirs.mjs";

export { SOURCE_ROOTS, TEST_DIRS };

/** opt out on one line, with a reason: `// check-cjs-globals: ok - why` */
export const IGNORE_MARKER = "check-cjs-globals: ok";

/** the conventional layout, used only when a package does not say what it publishes */
export const SOURCE_DIRS = ["source", "src"];

/**
 * `bin/` holds standalone sample-server scripts (e.g.
 * `node-opcua-role-set-test/bin/sample_server_with_role_set.ts`) that run directly under
 * Node and must be valid ES modules, but `shipped_dirs.mjs` deliberately excludes `bin`
 * from what a package publishes (it is invoked, not imported) and it is not a test tree
 * either. It is scanned in every scope here, unlike the sibling gates that never look at
 * it: this rule exists specifically because `if (require.main === module)` broke two of
 * these scripts.
 */
export const BIN_DIRS = ["bin"];

/** which directories to scan, mirroring check-import-extension's SCOPES, plus bin/ always */
export const SCOPES = {
    source: { shipped: true, extra: BIN_DIRS },
    tests: { shipped: false, extra: [...TEST_DIRS, ...BIN_DIRS] },
    all: { shipped: true, extra: [...TEST_DIRS, ...BIN_DIRS] }
};

const SKIP_DIRS = new Set(["node_modules", "dist", "dist-esm", "coverage", "build"]);

/** the CommonJS-only globals this rule flags as a value use */
const CJS_GLOBALS = new Set(["require", "module", "exports"]);

// ── package.json "type" resolution ──────────────────────────────────────────────

/**
 * The nearest `package.json`'s `"type"` above `dir`, walking upward - not the package
 * root, because a generated or vendored folder can carry its own manifest that overrides
 * the package's own type (a "nested scope-breaker"). Node.js resolution falls back to
 * "commonjs" when a manifest exists but names no `type`, and this mirrors that.
 */
export function nearestModuleType(dir) {
    let current = path.resolve(dir);
    while (true) {
        const candidate = path.join(current, "package.json");
        if (fs.existsSync(candidate)) {
            try {
                const pj = JSON.parse(fs.readFileSync(candidate, "utf8"));
                return pj.type === "module" ? "module" : "commonjs";
            } catch {
                return "commonjs";
            }
        }
        const parent = path.dirname(current);
        if (parent === current) {
            // no manifest found at all: nothing says otherwise, so assume ESM like the rest
            // of this workspace rather than failing closed on files outside any package.
            return "module";
        }
        current = parent;
    }
}

// ── scope resolution: is this identifier a free (unbound) reference? ───────────────

function isFunctionLike(node) {
    return (
        ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isConstructorDeclaration(node) ||
        ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node)
    );
}

/** does a binding name (identifier or destructuring pattern) declare `name`? */
function declaresName(bindingName, name) {
    if (!bindingName) {
        return false;
    }
    if (ts.isIdentifier(bindingName)) {
        return bindingName.text === name;
    }
    if (ts.isObjectBindingPattern(bindingName) || ts.isArrayBindingPattern(bindingName)) {
        return bindingName.elements.some((el) => ts.isBindingElement(el) && declaresName(el.name, name));
    }
    return false;
}

/** var/let/const/function/class declared directly in this block's own statement list */
function declaredDirectlyIn(statements, name) {
    for (const st of statements) {
        if (ts.isVariableStatement(st)) {
            if (st.declarationList.declarations.some((d) => declaresName(d.name, name))) {
                return true;
            }
        } else if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name?.text === name) {
            return true;
        }
    }
    return false;
}

/**
 * `var` hoists to the nearest function/module scope regardless of how many blocks it sits
 * inside, so a use anywhere in `container` can be bound by a `var` anywhere else in it -
 * except inside a nested function, which is a scope boundary of its own.
 */
function hasHoistedVar(container, name) {
    let found = false;
    const visit = (node) => {
        if (found || (isFunctionLike(node) && node !== container)) {
            return;
        }
        if (ts.isVariableStatement(node) && !(node.declarationList.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const))) {
            if (node.declarationList.declarations.some((d) => declaresName(d.name, name))) {
                found = true;
                return;
            }
        } else if (ts.isFunctionDeclaration(node) && node.name?.text === name && node !== container) {
            found = true;
            return;
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(container, visit);
    return found;
}

/** a name bound by an import in this source file: default, namespace, or named */
function importBinds(sourceFile, name) {
    for (const st of sourceFile.statements) {
        if (!ts.isImportDeclaration(st) || !st.importClause) {
            continue;
        }
        const clause = st.importClause;
        if (clause.name?.text === name) {
            return true;
        }
        const bindings = clause.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings) && bindings.name.text === name) {
            return true;
        }
        if (bindings && ts.isNamedImports(bindings)) {
            if (bindings.elements.some((el) => el.name.text === name)) {
                return true;
            }
        }
    }
    return false;
}

/**
 * True when `identifier` (whose text is one of `require`/`module`/`exports`) resolves to a
 * local binding rather than the free CommonJS global: a parameter, a var/let/const/function
 * declaration in an enclosing scope, a catch parameter, or an import. This is what lets
 * `const require = createRequire(import.meta.url)` and a parameter named `module` through.
 */
function isBoundLocally(identifier, sourceFile) {
    const name = identifier.text;
    let node = identifier;
    while (node) {
        const parent = node.parent;
        if (!parent) {
            break;
        }
        if (isFunctionLike(parent) && parent.parameters.some((p) => declaresName(p.name, name))) {
            return true;
        }
        if (isFunctionLike(parent) && parent.name?.text === name) {
            // a named function expression can refer to itself
            return true;
        }
        if (ts.isCatchClause(parent) && declaresName(parent.variableDeclaration?.name, name)) {
            return true;
        }
        if ((ts.isBlock(parent) || ts.isSourceFile(parent) || ts.isCaseBlock(parent) || ts.isModuleBlock(parent)) && declaredDirectlyIn(parent.statements, name)) {
            return true;
        }
        if (isFunctionLike(parent) && hasHoistedVar(parent, name)) {
            return true;
        }
        node = parent;
    }
    if (hasHoistedVar(sourceFile, name) || importBinds(sourceFile, name)) {
        return true;
    }
    return false;
}

/** true when the identifier sits somewhere the compiler erases: a type position */
function inTypePosition(node) {
    let p = node.parent;
    while (p) {
        if (ts.isTypeNode(p) || ts.isInterfaceDeclaration(p) || ts.isTypeAliasDeclaration(p)) {
            return true;
        }
        if (isFunctionLike(p) || ts.isBlock(p)) {
            return false;
        }
        p = p.parent;
    }
    return false;
}

/** true when the identifier is a declaration name, not a use: `const module = ...`, params, imports, etc. */
function isDeclarationName(node) {
    const p = node.parent;
    if (!p) {
        return false;
    }
    if (ts.isVariableDeclaration(p) && p.name === node) {
        return true;
    }
    if (ts.isBindingElement(p) && p.name === node) {
        return true;
    }
    if (ts.isParameter(p) && p.name === node) {
        return true;
    }
    if ((ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isClassDeclaration(p) || ts.isClassExpression(p)) && p.name === node) {
        return true;
    }
    if (ts.isImportSpecifier(p) && p.name === node) {
        return true;
    }
    if (ts.isImportClause(p) && p.name === node) {
        return true;
    }
    if (ts.isNamespaceImport(p) && p.name === node) {
        return true;
    }
    if (ts.isCatchClause(p) && p.variableDeclaration?.name === node) {
        return true;
    }
    return false;
}

/** true when the identifier is a property/member name rather than a free reference: `x.require`, `{ module: 1 }` */
function isPropertyOrLabelName(node) {
    const p = node.parent;
    if (!p) {
        return false;
    }
    if (ts.isPropertyAccessExpression(p) && p.name === node) {
        return true;
    }
    if (ts.isPropertyAssignment(p) && p.name === node) {
        return true;
    }
    if (ts.isPropertySignature(p) && p.name === node) {
        return true;
    }
    if (ts.isMethodDeclaration(p) && p.name === node) {
        return true;
    }
    if (ts.isQualifiedName(p) && p.right === node) {
        return true;
    }
    return false;
}

/** Violations in one file's text, as [{ line, name, text, ignored }]. Does not consider file-level exclusions. */
export function findViolations(text, filePath = "file.ts") {
    if (!CJS_GLOBALS_ANY(text)) {
        return [];
    }
    const scriptKind = /\.tsx$/.test(filePath) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(filePath, text, ts.ScriptTarget.ESNext, true, scriptKind);
    const lines = text.split("\n");
    const out = [];

    const visit = (node) => {
        if (ts.isIdentifier(node) && CJS_GLOBALS.has(node.text)) {
            const isUse = !isDeclarationName(node) && !isPropertyOrLabelName(node) && !inTypePosition(node);
            if (isUse && !isBoundLocally(node, sf)) {
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

function CJS_GLOBALS_ANY(text) {
    return text.includes("require") || text.includes("module") || text.includes("exports");
}

// ── --fix: only the one safe, exact idiom ───────────────────────────────────────────

const IMPORT_TO_ADD = 'import { pathToFileURL } from "node:url";';

/**
 * Rewrites only `if (require.main === module)` and its reversed spelling
 * `if (module === require.main)` to the ESM equivalent, and adds the `pathToFileURL`
 * import if it is not already present. Everything else is left untouched: the tool
 * refuses rather than guesses, the same philosophy `esm-convert` states for itself.
 */
export function fixText(text, filePath = "file.ts") {
    const pattern = /require\s*\.\s*main\s*===\s*module|module\s*===\s*require\s*\.\s*main/g;
    if (!pattern.test(text)) {
        return { text, fixed: 0 };
    }
    pattern.lastIndex = 0;
    let out = text.replace(pattern, 'import.meta.url === pathToFileURL(process.argv[1] ?? "").href');
    const fixed = (text.match(pattern) ?? []).length;

    if (fixed > 0 && !out.includes(IMPORT_TO_ADD) && !/from\s+["']node:url["']/.test(out)) {
        out = addNodeImport(out, filePath);
    }
    return { text: out, fixed };
}

/** insert the pathToFileURL import beside the file's other `node:` imports */
function addNodeImport(text, filePath) {
    const scriptKind = /\.tsx$/.test(filePath) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(filePath, text, ts.ScriptTarget.ESNext, true, scriptKind);
    const nodeImports = sf.statements.filter(
        (st) => ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier) && st.moduleSpecifier.text.startsWith("node:")
    );
    if (nodeImports.length > 0) {
        const last = nodeImports[nodeImports.length - 1];
        const insertAt = last.getEnd();
        return `${text.slice(0, insertAt)}\n${IMPORT_TO_ADD}${text.slice(insertAt)}`;
    }
    const anyImport = sf.statements.find((st) => ts.isImportDeclaration(st));
    if (anyImport) {
        const insertAt = anyImport.getStart(sf);
        return `${text.slice(0, insertAt)}${IMPORT_TO_ADD}\n${text.slice(insertAt)}`;
    }
    return `${IMPORT_TO_ADD}\n${text}`;
}

// ── scanning the tree ────────────────────────────────────────────────────────────

/**
 * `scope` is a SCOPES descriptor, or a plain array of directory names (which is what the
 * unit tests hand it), mirroring check-import-extension.
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
        } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
            // .cjs and .mjs already settle their own module format; not scanned at all
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
    let skipped = 0;

    for (const file of files) {
        if (nearestModuleType(path.dirname(file)) !== "module") {
            skipped++;
            continue;
        }
        let current = fs.readFileSync(file, "utf8");
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
    return { scanned: files.length - skipped, findings, exempt, fixedCount, fixedFiles, scope };
}

export function exitCode(result) {
    return result.findings.length > 0 ? 1 : 0;
}

export function formatReport(result) {
    const lines = [];
    if (result.fixedFiles > 0) {
        lines.push(`check-cjs-globals: rewrote ${result.fixedCount} use(s) in ${result.fixedFiles} files`, "");
    }
    const exemptNote = result.exempt > 0 ? `, ${result.exempt} exempted` : "";
    if (result.findings.length === 0) {
        lines.push(`check-cjs-globals: ${result.scanned} files scanned${exemptNote}, no CommonJS-only global used as a value.`);
        return lines.join("\n");
    }
    lines.push(`check-cjs-globals: ${result.findings.length} use(s) of require/module/exports, in ${result.scanned} files scanned${exemptNote}`, "");
    for (const f of result.findings) {
        lines.push(`    ${f.file}:${f.line}  ${f.text}`);
    }
    lines.push(
        "",
        "`require`, `module` and `exports` do not exist in an ES module. Every package here",
        'declares "type": "module", so a .ts or .js file inside one is an ES module even',
        "before it is built. `if (require.main === module)` fails at import time, not when",
        "the branch runs, which is why a test that only imports a file for its exports can",
        "crash on the reference alone.",
        "",
        "`node tools/check-cjs-globals.mjs --fix` rewrites exactly that idiom (and its",
        "reversed spelling) to:",
        "",
        '    if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {',
        "",
        "Anything else is reported and left alone. A deliberate synchronous require takes",
        "`const require = createRequire(import.meta.url);` in the same file, which this gate",
        "already recognizes as a binding rather than the global. A one-off exception takes",
        `// ${IGNORE_MARKER} - why`
    );
    return lines.join("\n");
}
