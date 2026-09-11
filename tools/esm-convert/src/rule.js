/**
 * rule - what converting one package to ESM involves, split into the part a tool can do and
 * the part that needs a person.
 *
 * The split is the point. Four things are mechanical, because earlier work made them so, or
 * because the shape is narrow enough to resolve with confidence:
 *
 *   type field      one line in package.json
 *   mocha config    `.mocharc.js` -> `.mocharc.cjs`, a rename, not a rewrite
 *   dirname anchor  `const here = __dirname;` -> `import.meta.dirname`
 *   entry shim      `module.exports = require("./dist...")` -> `export * from "./dist.../index.js"`
 *
 * The anchor is only mechanical because FEAT-1 concentrated the scattered uses into one line
 * per module and `check-dirname` keeps them that way. A tool cannot safely rewrite
 * `path.join(__dirname, ...)` sprinkled through a file; it can rewrite one known line.
 *
 * The entry shim exists because a package with no `exports` map falls back to whatever
 * `require()` resolves, and several packages point that at a one-line CommonJS file
 * (`nodeJS.js`, `testHelpers.js`) rather than the built output directly. Once the package is
 * ESM those files are parsed as ESM too, so `module.exports = require(...)` has to become
 * `export * from ...`. The tool only does this for the exact single-statement shape; a
 * `.d.ts` twin doing the same `export * from` gets the same treatment when its specifier
 * still lacks an extension.
 *
 * `packageFiles` only ever looked at `.ts`/`.mts`/`.cts`, so a plain `.js` file was invisible
 * to every check here. Once a package gets `"type": "module"`, every `.js` in it is parsed as
 * ESM too, so a hand-written CommonJS `.js` breaks - the shim is the one shape common enough
 * to rewrite; everything else CommonJS in a `.js` file is reported, split into a file that is
 * shipped or referenced (`cjs-module`, needs a decision) and a file that is neither
 * (`cjs-dead`, does not block conversion - it can just be deleted).
 *
 * Everything else is reported and left alone, because it changes behaviour rather than
 * syntax:
 *
 *   require() of package.json  an import attribute, a runtime read, or a build constant
 *   module.exports             a named or a default export, but which
 *   module-scope await         breaks require(esm) for every CJS consumer downstream
 *   typeof __filename/__dirname  always "undefined" under ESM: a live branch goes dead
 *
 * Any other require() is mechanical: createRequire keeps the call synchronous and the
 * specifier opaque, which is faithful in every context. `await import()` is often nicer,
 * but it needs the call site to be async and the target to exist as .js - and while a
 * package's tests still run its .ts sources through tsx, it does not.
 *
 * The tool refuses rather than guesses: a shim whose require specifier cannot be resolved
 * with confidence is reported, not rewritten.
 */

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { emittedFrom, shippedDirsOf, SOURCE_ROOTS } from "../../shared/shipped_dirs.mjs";
import { TEST_DIRS } from "../../shared/test_dirs.mjs";

const SKIP_DIRS = new Set(["node_modules", "dist", "dist-esm", "distNodeJS", "distHelpers", "coverage", "build"]);

/** the anchor FEAT-1 established, and the comment that goes with it */

/** the comment above an anchor, which says the opposite once the package is ESM */
const ANCHOR_COMMENT =
    /[ \t]*\/\/ The one place this module learns where it sits on disk\. `import\.meta\.dirname`\r?\n[ \t]*\/\/ cannot be used while this package emits CommonJS \(TS1470\), so the ESM migration\r?\n[ \t]*\/\/ has this single line to change rather than several scattered uses\.\r?\n/g;

export function packageDir(repoRoot, name) {
    for (const root of SOURCE_ROOTS) {
        const dir = path.join(repoRoot, root, name);
        if (fs.existsSync(path.join(dir, "package.json"))) {
            return dir;
        }
    }
    return null;
}

/** every .ts file in the package's shipped and test trees */
export function packageFiles(pkgDir) {
    const files = [];
    const roots = [...shippedDirsOf(pkgDir), ...TEST_DIRS];
    for (const sub of new Set(roots)) {
        walk(path.join(pkgDir, sub), files);
    }
    return files;
}

function walk(dir, out) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) walk(full, out);
        } else if (/\.(ts|mts|cts)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
            out.push(full);
        }
    }
}

/** every file under `dir`, skipping SKIP_DIRS and node_modules. `visit(fullPath, entryName)`. */
function walkGeneric(dir, visit) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) walkGeneric(full, visit);
        } else {
            visit(full, entry.name);
        }
    }
}

/**
 * Every plain `.js` file in the package, outside SKIP_DIRS and node_modules.
 *
 * `packageFiles` never looked here, which is the bug this file exists to fix: once a package
 * is ESM, a `.js` file in it is parsed as ESM too. `.mocharc.js` is excluded because the mocha
 * config is handled separately (a rename, not a scan), and `.cjs`/`.mjs` are excluded because
 * their extension already says what they are.
 */
export function jsFilesOf(pkgDir) {
    const files = [];
    walkGeneric(pkgDir, (full, name) => {
        if (name.endsWith(".js") && name !== ".mocharc.js") files.push(full);
    });
    return files;
}

// ── the mechanical half ─────────────────────────────────────────────────────────

/** add `"type": "module"`, or report that it is already there. Returns text or null. */
export function setTypeModule(text) {
    if (/"type"\s*:\s*"module"/.test(text)) return null;
    if (/"type"\s*:\s*"commonjs"/.test(text)) {
        return text.replace(/"type"\s*:\s*"commonjs"/, '"type": "module"');
    }
    const m = /(\n([ \t]+)"name"\s*:\s*"[^"]*",)/.exec(text);
    if (!m) return null;
    return text.replace(m[1], `${m[1]}\n${m[2]}"type": "module",`);
}

/**
 * Any surviving `require()`, kept but given something to resolve it.
 *
 * `createRequire` rather than `await import()` on purpose. import() is often the nicer form,
 * but it needs two things a mechanical rewrite cannot assume: a call site that is already
 * async, and a target that exists as `.js`. The second one bites immediately - a package's
 * tests run its `.ts` sources through tsx, so `import("./x.js")` asks the ESM loader for a
 * file that only appears after a build. That was tried here and broke three tests.
 *
 * createRequire keeps the call synchronous and the specifier opaque, which is faithful in
 * every context, including the deliberately non-literal specifier that exists so bundlers
 * skip it. Turning one into `await import()` afterwards is a normal refactor, done with the
 * call site in view.
 */
export function convertDynamicRequire(text) {
    if (!text.includes("require(") || text.includes("createRequire")) return null;
    const sf = ts.createSourceFile("f.ts", text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
    let hasRequire = false;
    const visit = (node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "require") {
            hasRequire = true;
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    if (!hasRequire) return null;

    const preamble =
        'import { createRequire } from "node:module";\n\n' +
        "// `require` does not exist in an ES module. It is kept rather than replaced by import()\n" +
        "// because import() is async and resolves against the emitted .js, neither of which is\n" +
        "// safe to assume at a call site a tool has not read. Converting one by hand is fine.\n" +
        "const require = createRequire(import.meta.url);\n\n";

    const firstCode = text.search(/^(?!\s*(\/\/|\/\*|\*|$))/m);
    return firstCode <= 0 ? preamble + text : text.slice(0, firstCode) + preamble + text.slice(firstCode);
}

/**
 * The mocha config an ESM package needs: the same CommonJS file, named `.mocharc.cjs`.
 *
 * Converting it to ESM would work - mocha 12 loads the config with require(), which on
 * Node >= 22.12 reads an ES module, and a converted transport ran its 103 tests that way.
 * It is still the wrong choice. `check-mocharc` mandates the `.cjs` name for a
 * `"type": "module"` package and renders the file's canonical shape; a second shape means
 * two generators emitting one file and drifting apart, for a test config that is never
 * published. So the gate stays the single owner of the content and this is a rename.
 *
 * Reported rather than done, so the caller can rename instead of write-and-delete.
 */
export function mocharcRename(pkgDir) {
    const from = path.join(pkgDir, ".mocharc.js");
    const to = path.join(pkgDir, ".mocharc.cjs");
    if (!fs.existsSync(from) || fs.existsSync(to)) return null;
    return { from, to };
}

/**
 * `__dirname` -> `import.meta.dirname`, everywhere it appears as code.
 *
 * FEAT-1 concentrated these into one anchor per module, because `import.meta` is illegal
 * while a package emits CommonJS (TS1470) and one line is easier to change than several.
 * That was an ergonomic choice, not a correctness one: in an ES module the substitution is
 * exact wherever it sits, so once a package is being flipped there is nothing left to
 * decide and the tool does all of them. `check-dirname` still keeps shipped source on the
 * anchor; the scattered uses this converts are in test trees, which that gate does not cover.
 *
 * A `typeof __filename` is left alone: it is asking whether the global exists, and the
 * answer under ESM is meant to be "no". Identifiers are found through the AST rather than a
 * regex so that prose mentioning `__dirname` in a comment is not rewritten.
 */
export function convertAnchors(text) {
    if (!text.includes("__dirname") && !text.includes("__filename")) return null;
    const sf = ts.createSourceFile("anchor.ts", text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
    const hits = [];
    const visit = (node) => {
        if (ts.isIdentifier(node) && (node.text === "__dirname" || node.text === "__filename") && !ts.isTypeOfExpression(node.parent)) {
            hits.push({ start: node.getStart(sf), end: node.getEnd(), name: node.text });
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    if (hits.length === 0) return null;

    let out = text;
    // back to front, so earlier offsets stay valid
    for (const h of hits.reverse()) {
        out = out.slice(0, h.start) + `import.meta.${h.name === "__dirname" ? "dirname" : "filename"}` + out.slice(h.end);
    }
    return out.replace(ANCHOR_COMMENT, "");
}

// ── the half that needs a person ────────────────────────────────────────────────

/** things whose ESM form changes behaviour, so the tool reports rather than rewrites */
export function findManualWork(text, filePath = "file.ts") {
    // `exports` and `__dirname` belong here as well as `module.exports`: a lone
    // `exports.foo = foo` beside an `export function` is a no-op under CJS emit and a
    // ReferenceError under ESM, and this guard is what let one sit in node-opcua-utils
    // while the survey called the package fully mechanical.
    if (!/\brequire\b|\bawait\b|\bexports\b|__dirname|__filename/.test(text)) return [];
    const sf = ts.createSourceFile(filePath, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
    const lines = text.split("\n");
    const out = [];
    const at = (node) => ts.getLineAndCharacterOfPosition(sf, node.getStart(sf)).line;

    const note = (node, kind, why) =>
        out.push({ line: at(node) + 1, kind, why, text: (lines[at(node)] ?? "").trim().slice(0, 90) });

    const visit = (node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "require") {
            const arg = node.arguments[0];
            if (arg && ts.isStringLiteral(arg) && arg.text.endsWith("package.json")) {
                // the one require whose ESM form is a real choice: an import attribute, a
                // runtime read, or a build-time constant. createRequire would work, but it
                // would also quietly keep a JSON require nobody meant to keep.
                note(node, "require-json", "an import attribute, a runtime read, or a build-time constant");
            }
            // a non-literal specifier is not reported: convertDynamicRequire handles it by
            // injecting createRequire, which keeps both the synchronous call and the opacity
            // that made the specifier a variable in the first place
        }
        if (ts.isPropertyAccessExpression(node) && node.expression.getText(sf) === "module" && node.name.text === "exports") {
            note(node, "module-exports", "replace with a named or default export");
        }
        // `exports.foo = ...`, which is neither `module.exports` nor an ES export
        if (
            ts.isBinaryExpression(node) &&
            node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            ts.isPropertyAccessExpression(node.left) &&
            ts.isIdentifier(node.left.expression) &&
            node.left.expression.text === "exports"
        ) {
            note(node, "cjs-exports", "`exports` does not exist in an ES module; use an export declaration");
        }
        if (ts.isAwaitExpression(node)) {
            // module scope only: a await inside a function is fine
            let p = node.parent;
            while (p && !ts.isFunctionLike(p) && !ts.isSourceFile(p)) p = p.parent;
            if (p && ts.isSourceFile(p)) {
                note(node, "top-level-await", "breaks require(esm) for every CJS consumer downstream");
            }
        }
        // `typeof __filename` / `typeof __dirname`: convertAnchors deliberately leaves these
        // alone because they ask whether the global exists, and under ESM the answer is
        // always "no" - which makes the branch that reads the value dead code.
        if (ts.isTypeOfExpression(node) && ts.isIdentifier(node.expression) && (node.expression.text === "__dirname" || node.expression.text === "__filename")) {
            note(node, "typeof-cjs-global", 'always "undefined" under ESM, so the branch that uses the value becomes dead');
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return out;
}

// ── the entry shim ──────────────────────────────────────────────────────────────

/** the comment lines a shim opens with, kept verbatim across the rewrite */
function leadingCommentLines(text) {
    const lines = text.split(/\r?\n/);
    const out = [];
    for (const line of lines) {
        if (/^\s*\/\//.test(line)) out.push(line);
        else break;
    }
    return out.length ? `${out.join("\n")}\n` : "";
}

/**
 * `module.exports = require("<spec>")`, and nothing else. Returns the specifier, or null if
 * the file is not exactly this shape - comments aside, this must be the file's only statement.
 */
export function parseEntryShim(text) {
    const sf = ts.createSourceFile("shim.js", text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
    if (sf.statements.length !== 1) return null;
    const stmt = sf.statements[0];
    if (!ts.isExpressionStatement(stmt)) return null;
    const expr = stmt.expression;
    if (!ts.isBinaryExpression(expr) || expr.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return null;
    if (
        !ts.isPropertyAccessExpression(expr.left) ||
        !ts.isIdentifier(expr.left.expression) ||
        expr.left.expression.text !== "module" ||
        expr.left.name.text !== "exports"
    ) {
        return null;
    }
    if (!ts.isCallExpression(expr.right) || !ts.isIdentifier(expr.right.expression) || expr.right.expression.text !== "require") {
        return null;
    }
    if (expr.right.arguments.length !== 1 || !ts.isStringLiteral(expr.right.arguments[0])) return null;
    return expr.right.arguments[0].text;
}

/**
 * `export * from "<spec>"`, and nothing else - the `.d.ts` twin of a shim.
 */
export function parseDtsReexport(text) {
    const sf = ts.createSourceFile("shim.d.ts", text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
    if (sf.statements.length !== 1) return null;
    const stmt = sf.statements[0];
    if (!ts.isExportDeclaration(stmt) || stmt.exportClause || !stmt.moduleSpecifier) return null;
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) return null;
    return stmt.moduleSpecifier.text;
}

/**
 * A shim's specifier, resolved to something `export * from` can use.
 *
 * A specifier already ending in `.js` is kept as-is. Otherwise it either names a directory
 * (the built output already exists, or the specifier is used bare because the emit renamed
 * `index.ts` away) or a tsconfig outDir (`emittedFrom`, because a `dist*` directory may not
 * exist yet in a fresh checkout) - either way `/index.js` is appended. Failing both, `.js` is
 * appended, which is correct for a specifier that already names a file rather than a
 * directory. A specifier that is not a relative path at all - a bare package import - cannot
 * be resolved this way with any confidence, so it is left to a person.
 */
export function resolveEntrySpecifier(pkgDir, spec) {
    if (!spec.startsWith(".")) return null;
    if (spec.endsWith(".js")) return spec;
    const bare = spec.replace(/^\.\//, "");
    const full = path.join(pkgDir, bare);
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) return `${spec}/index.js`;
    if (emittedFrom(pkgDir).has(bare)) return `${spec}/index.js`;
    return `${spec}.js`;
}

/** the sibling `.d.ts` of a `.js` file, same directory, same basename */
function dtsTwinPath(jsFile) {
    return jsFile.slice(0, -".js".length) + ".d.ts";
}

/**
 * The whole-package view of one `.js` entry shim: the rewrite for the file itself, and for
 * its `.d.ts` twin when that twin still has no extension on its specifier (TS2834 under
 * NodeNext once the package is ESM). A shim whose specifier cannot be resolved with
 * confidence is reported instead, under `cjs-entry`.
 */
export function entryShim(pkgDir, jsFile) {
    const text = fs.readFileSync(jsFile, "utf8");
    const spec = parseEntryShim(text);
    if (spec === null) return null;

    const resolved = resolveEntrySpecifier(pkgDir, spec);
    if (resolved === null) {
        return { file: jsFile, spec, resolved: null };
    }

    const rewritten = `${leadingCommentLines(text)}export * from "${resolved}";\n`;
    let dts = null;
    const twinPath = dtsTwinPath(jsFile);
    if (fs.existsSync(twinPath)) {
        const twinText = fs.readFileSync(twinPath, "utf8");
        const twinSpec = parseDtsReexport(twinText);
        if (twinSpec !== null && !twinSpec.endsWith(".js")) {
            dts = { file: twinPath, rewritten: `${leadingCommentLines(twinText)}export * from "${resolved}";\n` };
        }
    }
    return { file: jsFile, spec, resolved, rewritten, dts };
}

// ── CommonJS left behind in a .js file ──────────────────────────────────────────

/** a `require(...)` call, `module.exports`, or `exports.x = ...` - the CommonJS a .js file carries */
export function isCommonJsModule(text) {
    if (!/\brequire\s*\(|\bmodule\.exports\b|\bexports\s*\./.test(text)) return false;
    const sf = ts.createSourceFile("f.js", text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
    let found = false;
    const visit = (node) => {
        if (found) return;
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "require") {
            found = true;
        } else if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "module" && node.name.text === "exports") {
            found = true;
        } else if (
            ts.isBinaryExpression(node) &&
            node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            ts.isPropertyAccessExpression(node.left) &&
            ts.isIdentifier(node.left.expression) &&
            node.left.expression.text === "exports"
        ) {
            found = true;
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return found;
}

const stripLeadingDotSlash = (s) => s.replace(/^\.\//, "").replace(/\\/g, "/");

/** is `relPath` (relative to `pkgDir`) covered by the package's `files`, `main`, `bin` or `exports`? */
export function isShipped(manifest, relPath) {
    const rel = stripLeadingDotSlash(relPath);
    if (typeof manifest.main === "string" && stripLeadingDotSlash(manifest.main) === rel) return true;
    if (manifest.bin) {
        const bins = typeof manifest.bin === "string" ? [manifest.bin] : Object.values(manifest.bin);
        if (bins.some((b) => typeof b === "string" && stripLeadingDotSlash(b) === rel)) return true;
    }
    if (manifest.exports) {
        const leaves = [];
        const collect = (v) => {
            if (typeof v === "string") leaves.push(v);
            else if (v && typeof v === "object") for (const k of Object.keys(v)) collect(v[k]);
        };
        collect(manifest.exports);
        if (leaves.some((l) => stripLeadingDotSlash(l) === rel)) return true;
    }
    if (Array.isArray(manifest.files)) {
        for (const f of manifest.files) {
            const entry = stripLeadingDotSlash(f).replace(/\/$/, "");
            if (entry === rel || rel.startsWith(`${entry}/`)) return true;
        }
    }
    return false;
}

/** every bare `require(...)`/`import ... from`/`import(...)` specifier a file mentions */
function referencedSpecifiers(text) {
    const specs = new Set();
    const re = /\b(?:require|import)\s*\(\s*["'`]([^"'`]+)["'`]\s*\)|(?:^|[^.\w])(?:from|import)\s+["'`]([^"'`]+)["'`]/g;
    let m = re.exec(text);
    while (m) {
        specs.add(m[1] ?? m[2]);
        m = re.exec(text);
    }
    return specs;
}

/** resolve one specifier, seen in `fromFile`, to a `.js` file this tool knows about */
function resolveReference(fromFile, spec, pkgDirByName, allJsSet) {
    const candidates = [];
    if (spec.startsWith(".")) {
        const base = path.dirname(fromFile);
        for (const s of [spec, `${spec}.js`, `${spec}/index.js`]) candidates.push(path.normalize(path.join(base, s)));
    } else {
        const slash = spec.indexOf("/");
        if (slash === -1) return null;
        const pkgDir = pkgDirByName.get(spec.slice(0, slash));
        if (!pkgDir) return null;
        const subpath = spec.slice(slash + 1);
        for (const s of [subpath, `${subpath}.js`, `${subpath}/index.js`]) candidates.push(path.normalize(path.join(pkgDir, s)));
    }
    return candidates.find((c) => allJsSet.has(c)) ?? null;
}

/**
 * The workspace's reachability graph for `.js` files, computed once and shared across
 * `analyze()` calls: a dead file in one package can be referenced from another, so this has
 * to see the whole repo, not one package at a time.
 *
 * Live roots are every shipped file, every `.ts`/`.mts`/`.cts` file, and every `.d.ts` file.
 * From there, reference edges - read once per file, matched with a plain specifier regex, not
 * the full AST, because this only has to be good enough to find "nothing points here" - are
 * followed to a fixpoint. A `.js` file that only a dead file points to stays dead; a `.js`
 * file that a live file reaches, directly or through others, is live.
 */
export function computeLiveJsFiles(repoRoot = ".") {
    const names = allPackages(repoRoot);
    const pkgDirByName = new Map();
    const manifestByPkg = new Map();
    for (const name of names) {
        const dir = packageDir(repoRoot, name);
        if (!dir) continue;
        pkgDirByName.set(name, dir);
        try {
            manifestByPkg.set(name, JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")));
        } catch {
            manifestByPkg.set(name, {});
        }
    }

    const allJs = [];
    const liveRoots = [];
    const shippedJs = new Set();
    for (const [name, dir] of pkgDirByName) {
        const manifest = manifestByPkg.get(name) ?? {};
        walkGeneric(dir, (full, entryName) => {
            if (/\.d\.ts$/.test(entryName)) {
                liveRoots.push(full);
            } else if (/\.(ts|mts|cts)$/.test(entryName)) {
                liveRoots.push(full);
            } else if (entryName.endsWith(".js") && entryName !== ".mocharc.js") {
                allJs.push(full);
                if (isShipped(manifest, path.relative(dir, full))) {
                    shippedJs.add(full);
                    liveRoots.push(full);
                }
            }
        });
    }

    const allJsSet = new Set(allJs);
    const liveSet = new Set(liveRoots);
    const queue = [...liveSet];
    const textCache = new Map();
    while (queue.length) {
        const f = queue.pop();
        if (!textCache.has(f)) {
            try {
                textCache.set(f, fs.readFileSync(f, "utf8"));
            } catch {
                textCache.set(f, "");
            }
        }
        for (const spec of referencedSpecifiers(textCache.get(f))) {
            const resolved = resolveReference(f, spec, pkgDirByName, allJsSet);
            if (resolved && !liveSet.has(resolved)) {
                liveSet.add(resolved);
                queue.push(resolved);
            }
        }
    }

    return { liveSet, shippedJs, manifestByPkg, pkgDirByName };
}

/**
 * Directory names under which a static reference search cannot prove a file unused.
 *
 * A test tree builds fixture paths at runtime (`testPath("fixtures")`, then spawns the file
 * as a child process) rather than importing them, so no static reference will ever exist for
 * one - the same TEST_DIRS list used to walk a package's tests, plus `fixtures` on its own for
 * a fixture tree that does not sit under one of those. A `bin/` script is meant to be run by
 * hand and is often reached only through a README, not code.
 */
const UNPROVABLE_DEAD_DIRS = new Set([...TEST_DIRS, "fixtures", "bin"]);

/**
 * Is this `.js` file the kind of thing a static reference search cannot rule out, even when
 * it finds no reference at all - a test fixture reached by a computed path, or a script run
 * by hand? `cjs-dead` means "safe to delete", so it must only ever be emitted when deadness is
 * provable from static references; anything that can be loaded by a computed path or run
 * directly is at worst a decision, never dead.
 */
function isUnprovableDead(file, text) {
    const segments = file.replace(/\\/g, "/").split("/");
    if (segments.some((s) => UNPROVABLE_DEAD_DIRS.has(s))) return true;
    return /^#!/.test(text);
}

/**
 * One package's `.js` files, sorted into: entry shims (mechanical, or `cjs-entry` when the
 * specifier cannot be resolved), CommonJS that is shipped or referenced (`cjs-module`, needs
 * a decision - including any `.js` in a `"private": true` package, since those are run by
 * hand rather than imported, and any test fixture or script a static search cannot rule out),
 * and CommonJS that is neither (`cjs-dead`, safe to delete but not blocking).
 */
export function classifyJsFiles(pkgDir, packageName, liveness) {
    const manifest = liveness.manifestByPkg.get(packageName) ?? {};
    const isPrivate = manifest.private === true;

    const shims = [];
    const cjsEntries = [];
    const cjsModules = [];
    const deadFiles = [];

    for (const file of jsFilesOf(pkgDir)) {
        const shim = entryShim(pkgDir, file);
        if (shim) {
            if (shim.resolved === null) {
                cjsEntries.push({
                    file: file.replace(/\\/g, "/"),
                    kind: "cjs-entry",
                    why: "the require specifier is not a relative path, so the tool cannot resolve it with confidence",
                    line: 1,
                    text: `module.exports = require("${shim.spec}")`
                });
            } else {
                shims.push(shim);
            }
            continue;
        }

        const text = fs.readFileSync(file, "utf8");
        if (!isCommonJsModule(text)) continue;

        const rel = file.replace(/\\/g, "/");
        const shipped = liveness.shippedJs.has(file);
        const live = shipped || liveness.liveSet.has(file) || isUnprovableDead(file, text);
        if (live || isPrivate) {
            cjsModules.push({
                file: rel,
                kind: "cjs-module",
                why: "a CommonJS file in an ESM package is parsed as ESM: rename to .cjs, port it, or keep the package CommonJS",
                line: 1,
                text: "module.exports / require() in this file"
            });
        } else {
            deadFiles.push({
                file: rel,
                kind: "cjs-dead",
                why: "not shipped and nothing live references it: delete before flipping"
            });
        }
    }

    return { shims, cjsEntries, cjsModules, deadFiles };
}

// ── putting it together ─────────────────────────────────────────────────────────

/** every package in the workspace, published or not: a flip has to reach all of them */
export function allPackages(repoRoot = ".") {
    const names = [];
    for (const root of SOURCE_ROOTS) {
        const full = path.join(repoRoot, root);
        if (!fs.existsSync(full)) continue;
        for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
            if (entry.isDirectory() && fs.existsSync(path.join(full, entry.name, "package.json"))) {
                names.push(entry.name);
            }
        }
    }
    return names.sort();
}

/**
 * The whole workspace, sorted into what a tool can finish and what needs a person.
 *
 * This is the number that matters for planning FEAT-2: a package with no manual work can be
 * converted, rebuilt and tested without anyone reading it. `needsDecision` is not restricted
 * to packages that are not yet ESM: a package can already carry `"type": "module"` and still
 * have CommonJS left behind (an entry shim nobody rewrote, a `.js` that needs a decision), and
 * that has to show up here too rather than being hidden behind the `alreadyEsm` flag.
 */
export function survey({ repoRoot = "." } = {}) {
    const liveness = computeLiveJsFiles(repoRoot);
    const packages = allPackages(repoRoot).map((name) => analyze({ repoRoot, packageName: name, liveness }));
    return {
        total: packages.length,
        alreadyEsm: packages.filter((p) => p.alreadyEsm && p.manual.length === 0),
        mechanical: packages.filter((p) => !p.alreadyEsm && p.manual.length === 0),
        needsDecision: packages.filter((p) => p.manual.length > 0),
        stillHasCommonJs: packages.filter((p) => p.alreadyEsm && (p.shims.length > 0 || p.manual.length > 0)),
        deadTotal: packages.reduce((n, p) => n + p.deadFiles.length, 0),
        packages
    };
}

export function analyze({ repoRoot = ".", packageName, liveness } = {}) {
    const dir = packageDir(repoRoot, packageName);
    if (!dir) return { found: false, packageName };

    const manifestPath = path.join(dir, "package.json");
    const manifest = fs.readFileSync(manifestPath, "utf8");
    const alreadyEsm = /"type"\s*:\s*"module"/.test(manifest);

    const rename = mocharcRename(dir);

    const anchors = [];
    const dynamicRequires = [];
    const manual = [];
    for (const file of packageFiles(dir)) {
        const text = fs.readFileSync(file, "utf8");
        if (convertAnchors(text) !== null) anchors.push(file.replace(/\\/g, "/"));
        if (convertDynamicRequire(text) !== null) dynamicRequires.push(file.replace(/\\/g, "/"));
        for (const m of findManualWork(text, file)) manual.push({ file: file.replace(/\\/g, "/"), ...m });
    }

    const live = liveness ?? computeLiveJsFiles(repoRoot);
    const { shims, cjsEntries, cjsModules, deadFiles } = classifyJsFiles(dir, packageName, live);
    for (const e of cjsEntries) manual.push(e);
    for (const m of cjsModules) manual.push(m);

    return {
        found: true,
        packageName,
        dir: dir.replace(/\\/g, "/"),
        alreadyEsm,
        mocharc: rename ? "rename" : "none",
        anchors,
        dynamicRequires,
        manual,
        shims,
        deadFiles
    };
}
