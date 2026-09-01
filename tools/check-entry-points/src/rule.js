/**
 * rule - a package's `types` must describe the module its `main` loads, and the
 * implementation it publishes must say that it is implementation.
 *
 * Two lists that have to agree, with nothing checking them, is how node-opcua-address-space
 * came to declare twelve names its main did not deliver:
 *
 *     import { CloneHelper } from "node-opcua";   // compiles, undefined at run time
 *
 * and fifty-two more that main delivered and no TypeScript consumer could name. The umbrella
 * re-exports that package, so the whole published API carried it.
 *
 * Two checks, both mechanical:
 *
 *   entry     `types` names the declarations beside the file `main` names. When the two point
 *             at different modules there is no reason for their contents to match, and over
 *             time they do not.
 *
 *   internal  an exported symbol shaped like implementation - `*Impl`, `*ImplBase`, a leading
 *             underscore - carries an internal tag, so typedoc's excludeInternal keeps it out
 *             of the documentation. This is about what the published surface says it is, not
 *             about what it contains.
 */

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { shippedDirsOf } from "../../shared/shipped_dirs.mjs";

/** opt out on one line, with a reason: `// check-entry-points: ok - why` */
export const IGNORE_MARKER = "check-entry-points: ok";

export const SOURCE_ROOTS = ["packages", "packages_extra"];

const SKIP_DIRS = new Set(["node_modules", "dist", "dist-esm", "distNodeJS", "distHelpers", "coverage", "build"]);

/** the shapes that say "implementation" rather than "API" */
export const INTERNAL_SHAPE = /Impl$|ImplBase$|^_/;

/**
 * Does `types` describe what `main` loads?
 *
 * The coherent case is a .d.ts sitting beside the .js, which is what tsc emits. Anything else
 * is two modules, and then the two lists drift.
 */
export function classifyEntry(pkg) {
    const main = (pkg.main ?? "").replace(/^\.\//, "");
    const types = (pkg.types ?? pkg.typings ?? "").replace(/^\.\//, "");
    if (!main && !types) return { kind: "no-entry" };
    if (!main) return { kind: "no-main" };
    if (!types) return { kind: "no-types" };
    const beside = main.replace(/\.[cm]?js$/, ".d.ts");
    return path.normalize(beside) === path.normalize(types) ? { kind: "ok" } : { kind: "split", main, types, beside };
}

/** every exported symbol name in a file, with whether its declaration is tagged internal */
export function exportedSymbols(text, filePath) {
    const sf = ts.createSourceFile(filePath, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
    const out = [];
    for (const st of sf.statements) {
        const mods = ts.canHaveModifiers(st) ? (ts.getModifiers(st) ?? []) : [];
        if (!mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;

        const names = [];
        if (ts.isClassDeclaration(st) || ts.isFunctionDeclaration(st) || ts.isInterfaceDeclaration(st)) {
            if (st.name) names.push(st.name.text);
        } else if (ts.isTypeAliasDeclaration(st) || ts.isEnumDeclaration(st)) {
            names.push(st.name.text);
        } else if (ts.isVariableStatement(st)) {
            for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) names.push(d.name.text);
        }
        if (!names.length) continue;

        const lead = text.slice(st.getFullStart(), st.getStart(sf));
        const { line } = ts.getLineAndCharacterOfPosition(sf, st.getStart(sf));
        for (const name of names) {
            out.push({ name, line: line + 1, tagged: /@internal/.test(lead), ignored: lead.includes(IGNORE_MARKER) });
        }
    }
    return out;
}

/**
 * The names a package actually publishes, by walking its entry's export statements.
 *
 * Scoping the tag check to these is the point: a package exports its implementation classes
 * between its own modules all the time - BaseNodeImpl, UAVariableImpl, _clone - and those
 * never reach the documentation, because typedoc only follows what the entry point exposes.
 * Flagging them would be a gate reporting on something it does not actually guard.
 */
export function publishedDeclarations(entryFile) {
    const seen = new Set();
    /** name -> { value: boolean, ambient: {file,line} | null } */
    const decls = new Map();

    const note = (name, kind, where) => {
        const d = decls.get(name) ?? { value: false, ambient: null };
        if (kind === "value") d.value = true;
        if (kind === "ambient" && !d.ambient) d.ambient = where;
        decls.set(name, d);
    };

    const visit = (file) => {
        if (seen.has(file) || !fs.existsSync(file)) return;
        seen.add(file);
        const text = fs.readFileSync(file, "utf8");
        const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);

        for (const st of sf.statements) {
            if (ts.isExportDeclaration(st)) {
                const spec = st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier) ? st.moduleSpecifier.text : null;
                if (st.exportClause && ts.isNamedExports(st.exportClause)) {
                    // a re-export carries whatever the other module has; `export type` does not
                    const kind = st.isTypeOnly ? "type" : "value";
                    for (const el of st.exportClause.elements) note(el.name.text, el.isTypeOnly ? "type" : kind, null);
                    continue; // an explicit list does not pull in the rest of that module
                }
                // `export * from "..."`: everything that module publishes, recursively
                if (spec?.startsWith(".")) visit(resolveTs(file, spec));
                continue;
            }
            const mods = ts.canHaveModifiers(st) ? (ts.getModifiers(st) ?? []) : [];
            if (!mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;

            // `declare` emits nothing: it promises a value that some other module must provide
            const isAmbient = mods.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword);
            const { line } = ts.getLineAndCharacterOfPosition(sf, st.getStart(sf));
            const where = { file, line: line + 1 };

            if (ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st)) {
                // type-only by construction, and legitimately so
                note(st.name.text, "type", null);
            } else if (ts.isClassDeclaration(st) || ts.isFunctionDeclaration(st)) {
                if (st.name) note(st.name.text, isAmbient ? "ambient" : "value", where);
            } else if (ts.isEnumDeclaration(st)) {
                note(st.name.text, isAmbient ? "ambient" : "value", where);
            } else if (ts.isVariableStatement(st)) {
                const ambient = isAmbient || st.declarationList.declarations.every((d) => !d.initializer);
                for (const d of st.declarationList.declarations) {
                    if (ts.isIdentifier(d.name)) note(d.name.text, ambient ? "ambient" : "value", where);
                }
            }
        }
    };

    visit(entryFile);
    return decls;
}

/** the names a package publishes, whatever kind of declaration each has */
export function publishedNames(entryFile) {
    return new Set(publishedDeclarations(entryFile).keys());
}

/** a relative specifier as written for ESM (".js") back to the .ts it is emitted from */
function resolveTs(fromFile, specifier) {
    const base = path.resolve(path.dirname(fromFile), specifier).replace(/\\/g, "/");
    for (const candidate of [base.replace(/\.js$/, ".ts"), `${base}.ts`, `${base}/index.ts`]) {
        if (fs.existsSync(candidate)) return candidate;
    }
    return base;
}

/** the .ts files under one directory, skipping build output */
function sourceFilesUnder(dir) {
    if (!fs.existsSync(dir)) return [];
    const out = [];
    const stack = [dir];
    while (stack.length) {
        const d = stack.pop();
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const full = path.join(d, e.name).replace(/\\/g, "/");
            if (e.isDirectory()) {
                if (!SKIP_DIRS.has(e.name)) stack.push(full);
            } else if (/\.ts$/.test(e.name) && !e.name.endsWith(".d.ts")) {
                out.push(full);
            }
        }
    }
    return out;
}

/** every package, with its package.json path and the source files it publishes */
export function findPackages(repoRoot = ".", packageFilter) {
    const packages = [];
    for (const root of SOURCE_ROOTS) {
        const full = path.join(repoRoot, root);
        if (!fs.existsSync(full)) continue;
        for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
            if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
            if (packageFilter && entry.name !== packageFilter) continue;
            const dir = path.join(full, entry.name).replace(/\\/g, "/");
            const pjPath = path.join(dir, "package.json");
            if (!fs.existsSync(pjPath)) continue;
            const files = shippedDirsOf(dir).flatMap((sub) => sourceFilesUnder(path.join(dir, sub)));
            packages.push({ name: entry.name, dir, pjPath, files });
        }
    }
    return packages;
}

/**
 * The .ts the package's declarations are emitted from.
 *
 * `types` names a built file, so the source has to be found rather than read off. The layouts
 * in this repository are `dist/index.d.ts` from `source/index.ts` and `dist/source/index.d.ts`
 * from `source/index.ts`, with `src/` in place of `source/` here and there, so each shape is
 * tried and the first that exists wins. Returns null when none does, and the caller then
 * checks nothing rather than checking the wrong thing.
 */
export function entrySourceFor(pkgDir, pkgJson) {
    const types = (pkgJson.types ?? pkgJson.typings ?? "").replace(/^\.\//, "");
    if (!types.endsWith(".d.ts")) return null;
    const withoutDist = types.replace(/^dist\//, "").replace(/\.d\.ts$/, ".ts");
    const bare = path.basename(withoutDist);
    const candidates = [withoutDist, path.join("source", withoutDist), path.join("src", withoutDist), path.join("source", bare), path.join("src", bare)];
    for (const c of candidates) {
        const full = path.join(pkgDir, c);
        if (fs.existsSync(full)) return full;
    }
    return null;
}

export function analyze({ repoRoot = ".", packageFilter } = {}) {
    const packages = findPackages(repoRoot, packageFilter);
    const entryFindings = [];
    const internalFindings = [];
    const phantomFindings = [];
    let scanned = 0;

    for (const pkg of packages) {
        const p = JSON.parse(fs.readFileSync(pkg.pjPath, "utf8"));
        if (p.private) continue;

        const entry = classifyEntry(p);
        if (entry.kind === "split") {
            entryFindings.push({ package: pkg.name, ...entry });
        }

        const entrySource = entrySourceFor(pkg.dir, p);
        const declarations = entrySource ? publishedDeclarations(entrySource) : null;
        const published = declarations ? new Set(declarations.keys()) : null;

        // a `declare` promises a value that some module has to provide. When none does, the
        // name is in the .d.ts and undefined at run time - it compiles and gives you nothing.
        for (const [name, d] of declarations ?? []) {
            if (d.ambient && !d.value) {
                // resolveTs walks with absolute paths; report where the reader can find it
                const rel = path.relative(repoRoot, d.ambient.file).split(path.sep).join("/");
                phantomFindings.push({ package: pkg.name, name, file: rel, line: d.ambient.line });
            }
        }

        for (const file of pkg.files) {
            scanned++;
            const text = fs.readFileSync(file, "utf8");
            for (const sym of exportedSymbols(text, file)) {
                if (!INTERNAL_SHAPE.test(sym.name)) continue;
                if (sym.tagged || sym.ignored) continue;
                // only what the package actually publishes: the rest never reaches the docs
                if (published && !published.has(sym.name)) continue;
                internalFindings.push({ file, line: sym.line, name: sym.name, package: pkg.name });
            }
        }
    }
    return { packages: packages.length, scanned, entryFindings, internalFindings, phantomFindings };
}

/**
 * Per-package counts of untagged implementation exports, as a ratchet.
 *
 * The entry check is absolute: no package may split its main from its types, and none does.
 * The tag check is a baseline, because 62 of these predate the rule across fourteen packages
 * and tagging them all is not this rule's job. A package may lower its number, never raise
 * it. `--update` rewrites the file after a legitimate removal.
 */
export function overBaseline(result, baseline) {
    const counts = new Map();
    for (const f of result.internalFindings) counts.set(f.package, (counts.get(f.package) ?? 0) + 1);
    const over = [];
    for (const [pkg, n] of counts) {
        const allowed = baseline[pkg] ?? 0;
        if (n > allowed) over.push({ package: pkg, count: n, allowed });
    }
    return over;
}

export function currentCounts(result) {
    const counts = {};
    for (const f of result.internalFindings) counts[f.package] = (counts[f.package] ?? 0) + 1;
    return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

export function exitCode(result, baseline = {}) {
    const phantoms = result.phantomFindings ?? [];
    return result.entryFindings.length > 0 || phantoms.length > 0 || overBaseline(result, baseline).length > 0 ? 1 : 0;
}

export function formatReport(result, baseline = {}) {
    const lines = [];
    const over = overBaseline(result, baseline);

    const phantoms = result.phantomFindings ?? [];

    if (phantoms.length) {
        lines.push(`check-entry-points: ${phantoms.length} name(s) declared in the types and defined nowhere`, "");
        for (const f of phantoms.slice(0, 20)) {
            lines.push(`  ${f.file}:${f.line}  ${f.name}   (${f.package})`);
        }
        lines.push("");
        lines.push("  A `declare` promises a value that some module has to provide. When none does, the");
        lines.push("  name reaches the .d.ts and is undefined at run time: importing it compiles and gives");
        lines.push("  you nothing. Either export the implementation, or delete the declaration.");
        lines.push("");
    }

    if (result.entryFindings.length === 0 && over.length === 0 && phantoms.length === 0) {
        const tally = result.internalFindings.length;
        lines.push(
            `check-entry-points: ${result.packages} packages, ${result.scanned} files. Every types field describes ` +
                `its own main, every declared name is defined` +
                `${tally ? `, and no package exceeds its untagged-export baseline (${tally} total)` : ""}.`
        );
        return lines.join("\n");
    }

    if (over.length) {
        lines.push(`check-entry-points: ${over.length} package(s) above their untagged-export baseline`, "");
        for (const o of over) {
            lines.push(`  ${o.package}: ${o.count}, baseline ${o.allowed}`);
            for (const f of result.internalFindings.filter((f) => f.package === o.package).slice(0, 10)) {
                lines.push(`      ${f.file}:${f.line}  ${f.name}`);
            }
        }
        lines.push("");
        lines.push("  typedoc runs with excludeInternal, so an untagged Impl gets a page in the published");
        lines.push("  documentation. Add /** @internal */ to the declaration, or the marker with a reason:");
        lines.push(`  // ${IGNORE_MARKER} - why. Lower the baseline when you remove one; it only tightens.`);
        return lines.join("\n");
    }

    if (result.entryFindings.length) {
        lines.push(`check-entry-points: ${result.entryFindings.length} package(s) whose types and main name different modules`, "");
        for (const f of result.entryFindings) {
            lines.push(`  ${f.package}`);
            lines.push(`      main:  ${f.main}`);
            lines.push(`      types: ${f.types}     (expected ${f.beside})`);
        }
        lines.push("");
        lines.push("  A consumer takes values through main and types through types. When the two name");
        lines.push("  different modules nothing keeps their contents in step, and they drift: a name");
        lines.push("  the .d.ts declares and main does not export compiles and is undefined at run time.");
        lines.push("");
    }

    return lines.join("\n");
}
