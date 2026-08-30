/**
 * rule - circular imports that would throw under ESM.
 *
 * A cycle is not a defect on its own. Under ESM the bindings are hoisted and live, and
 * the failure is a TDZ ReferenceError, which happens only if a module *uses* a binding
 * from a cyclic partner while its own body is still evaluating. If every use is inside a
 * function that runs later, the cycle behaves exactly as it does under CommonJS.
 *
 * That distinction is the whole point of this tool. Shipped source had 14 cycles and only
 * 3 could break; a gate that failed on all 14 would be noise and would be switched off.
 *
 * What counts as a use at module-evaluation time:
 *   - a reference at module scope, e.g. `const map = { Method: UAMethodImpl }`
 *   - a heritage clause, `class X extends Y`, even though it sits inside a class body:
 *     `extends` is evaluated when the class declaration is evaluated
 *
 * `import type` and `import { type X }` are erased before runtime, so they create no edge
 * at all.
 */

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

export const SOURCE_ROOTS = ["packages", "packages_extra"];
export const SOURCE_DIRS = ["source", "src"];

const SKIP_DIRS = new Set(["node_modules", "dist", "dist-esm", "coverage", "build"]);

/** opt out of the rule for one cycle, with a reason, on any member file */
export const IGNORE_MARKER = "check-import-cycles: ok";

const isFile = (p) => {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
};

/** resolve a relative specifier to a file in the tree, tolerating the .js extension */
export function resolveSpecifier(fromFile, specifier) {
    const base = path.posix.join(path.posix.dirname(fromFile.replace(/\\/g, "/")), specifier).replace(/\.js$/, "");
    for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
        if (isFile(candidate)) {
            return candidate;
        }
    }
    return null;
}

/** true for any node that opens a function scope: a use inside one happens later */
function opensFunctionScope(node) {
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

/** a heritage clause runs when the class declaration runs, even inside a class body */
function inHeritageClause(node) {
    let p = node.parent;
    while (p) {
        if (ts.isHeritageClause(p)) {
            return true;
        }
        if (opensFunctionScope(p)) {
            return false;
        }
        p = p.parent;
    }
    return false;
}

/**
 * Parse one file: its runtime edges and the local names each brings in.
 * Returns { deps: string[], bindings: Map<localName, targetFile>, sourceFile, ignored }.
 */
export function readModule(file, text) {
    const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
    const deps = new Set();
    const bindings = new Map();

    for (const st of sourceFile.statements) {
        if (ts.isImportDeclaration(st) && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier)) {
            const spec = st.moduleSpecifier.text;
            if (!spec.startsWith(".")) {
                continue;
            }
            const target = resolveSpecifier(file, spec);
            if (!target) {
                continue;
            }
            const clause = st.importClause;

            // `import "./x.js"` has no clause at all. It is a side-effect import, which is
            // very much a runtime edge and forces the target to evaluate.
            if (!clause) {
                deps.add(target);
                continue;
            }
            // `import type { X } from` is erased whole
            if (clause.isTypeOnly) {
                continue;
            }

            const names = [];
            if (clause.name) {
                names.push(clause.name.text);
            }
            if (clause.namedBindings) {
                if (ts.isNamespaceImport(clause.namedBindings)) {
                    names.push(clause.namedBindings.name.text);
                } else {
                    for (const el of clause.namedBindings.elements) {
                        if (!el.isTypeOnly) {
                            names.push(el.name.text);
                        }
                    }
                }
            }
            // `import { type A, type B } from` has a clause but nothing survives it, so
            // TypeScript elides the statement and there is no runtime edge either.
            if (names.length === 0) {
                continue;
            }
            deps.add(target);
            for (const n of names) {
                bindings.set(n, target);
            }
        } else if (ts.isExportDeclaration(st) && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier) && !st.isTypeOnly) {
            const spec = st.moduleSpecifier.text;
            if (!spec.startsWith(".")) {
                continue;
            }
            const target = resolveSpecifier(file, spec);
            if (target) {
                deps.add(target);
            }
        }
    }
    return { deps: [...deps], bindings, sourceFile, ignored: text.includes(IGNORE_MARKER) };
}

/**
 * Tarjan, iteratively. The recursive form overflows the default stack on a graph this
 * size and would make the gate depend on --stack-size, which a CI step should not.
 */
export function stronglyConnectedComponents(nodes, edgesOf) {
    let counter = 0;
    const index = new Map();
    const low = new Map();
    const onStack = new Set();
    const stack = [];
    const components = [];

    for (const start of nodes) {
        if (index.has(start)) {
            continue;
        }
        const work = [{ v: start, i: 0 }];
        while (work.length > 0) {
            const frame = work[work.length - 1];
            const v = frame.v;
            if (frame.i === 0) {
                index.set(v, counter);
                low.set(v, counter);
                counter++;
                stack.push(v);
                onStack.add(v);
            }
            const deps = edgesOf(v);
            let descended = false;
            while (frame.i < deps.length) {
                const w = deps[frame.i];
                frame.i++;
                if (!index.has(w)) {
                    work.push({ v: w, i: 0 });
                    descended = true;
                    break;
                }
                if (onStack.has(w)) {
                    low.set(v, Math.min(low.get(v), index.get(w)));
                }
            }
            if (descended) {
                continue;
            }
            if (low.get(v) === index.get(v)) {
                const component = [];
                let w;
                do {
                    w = stack.pop();
                    onStack.delete(w);
                    component.push(w);
                } while (w !== v);
                if (component.length > 1 || edgesOf(v).includes(v)) {
                    components.push(component);
                }
            }
            work.pop();
            if (work.length > 0) {
                const parent = work[work.length - 1].v;
                low.set(parent, Math.min(low.get(parent), low.get(v)));
            }
        }
    }
    return components;
}

/**
 * Uses, at module-evaluation time, of a binding imported from another member of the same
 * cycle. These are what make a cycle fatal.
 */
export function dangerousUses(file, module, members) {
    const cyclic = new Map([...module.bindings].filter(([, target]) => members.has(target) && target !== file));
    if (cyclic.size === 0) {
        return [];
    }
    const { sourceFile } = module;
    const found = [];
    const seen = new Set();

    const visit = (node, insideFunction) => {
        const nested = insideFunction || opensFunctionScope(node);
        if (ts.isIdentifier(node) && cyclic.has(node.text)) {
            const heritage = inHeritageClause(node);
            if (!nested || heritage) {
                // the import statement itself is not a use
                let p = node.parent;
                let inImport = false;
                while (p) {
                    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) {
                        inImport = true;
                        break;
                    }
                    p = p.parent;
                }
                if (!inImport) {
                    const { line } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
                    const key = `${line}:${node.text}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        found.push({ line: line + 1, name: node.text, from: cyclic.get(node.text), heritage });
                    }
                }
            }
        }
        ts.forEachChild(node, (child) => visit(child, nested));
    };
    ts.forEachChild(sourceFile, (child) => visit(child, false));
    return found;
}

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
            for (const dir of SOURCE_DIRS) {
                walk(path.join(full, pkg.name, dir), files);
            }
        }
    }
    return files.map((f) => f.replace(/\\/g, "/"));
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
        } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
            out.push(full);
        }
    }
}

/** scan; returns { scanned, cycles: [{ files, dangerous, uses, ignored }] } */
export function analyze({ repoRoot = ".", packageFilter } = {}) {
    const files = findSourceFiles(repoRoot, packageFilter);
    const modules = new Map();
    for (const f of files) {
        modules.set(f, readModule(f, fs.readFileSync(f, "utf8")));
    }
    const edgesOf = (v) => modules.get(v)?.deps ?? [];
    const components = stronglyConnectedComponents([...modules.keys()], edgesOf);

    const cycles = [];
    for (const component of components) {
        const members = new Set(component);
        const uses = [];
        let ignored = false;
        for (const f of component) {
            const m = modules.get(f);
            if (m.ignored) {
                ignored = true;
            }
            for (const u of dangerousUses(f, m, members)) {
                uses.push({ file: f, ...u });
            }
        }
        cycles.push({ files: component.sort(), dangerous: uses.length > 0 && !ignored, uses, ignored });
    }
    cycles.sort((a, b) => Number(b.dangerous) - Number(a.dangerous) || b.files.length - a.files.length);
    return { scanned: files.length, cycles };
}

export function exitCode(result) {
    return result.cycles.some((c) => c.dangerous) ? 1 : 0;
}

const short = (f) => f.replace(/^packages(_extra)?\//, "");

export function formatReport(result, { showBenign = false } = {}) {
    const dangerous = result.cycles.filter((c) => c.dangerous);
    const benign = result.cycles.filter((c) => !c.dangerous);
    const lines = [];

    if (dangerous.length === 0) {
        lines.push(`check-import-cycles: ${result.scanned} files scanned, ${result.cycles.length} cycles, none that ESM would reject.`);
    } else {
        lines.push(`check-import-cycles: ${dangerous.length} cycle(s) would throw under ESM, of ${result.cycles.length} in ${result.scanned} files`, "");
        for (const c of dangerous) {
            lines.push(`  ${c.files.length} files:`);
            for (const f of c.files) {
                lines.push(`      ${short(f)}`);
            }
            lines.push(`    used while the module body is still evaluating:`);
            for (const u of c.uses) {
                lines.push(`      ${short(u.file)}:${u.line}  ${u.name}${u.heritage ? "   (extends/implements)" : ""}`);
            }
            lines.push("");
        }
        lines.push("A cycle only breaks under ESM when a member uses a cyclic binding while its");
        lines.push("own body runs - a class heritage clause, or a module-scope initializer. Move");
        lines.push("the shared piece into a module both sides can depend on, or invert the");
        lines.push("dependency so the value is injected rather than imported.");
    }

    if (showBenign && benign.length > 0) {
        lines.push("", `${benign.length} benign cycle(s) - every cyclic binding is only used inside a function:`);
        for (const c of benign) {
            lines.push(`  ${String(c.files.length).padStart(3)} files  ${short(c.files[0])}${c.ignored ? "   [ignored by marker]" : ""}`);
        }
    }
    return lines.join("\n");
}
