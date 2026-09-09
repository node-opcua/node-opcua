/**
 * rule - what converting one package to ESM involves, split into the part a tool can do and
 * the part that needs a person.
 *
 * The split is the point. Three things are mechanical, because earlier work made them so:
 *
 *   type field      one line in package.json
 *   mocha config    `module.exports` -> `export default`, `require` -> createRequire
 *   dirname anchor  `const here = __dirname;` -> `import.meta.dirname`
 *
 * The anchor is only mechanical because FEAT-1 concentrated the scattered uses into one line
 * per module and `check-dirname` keeps them that way. A tool cannot safely rewrite
 * `path.join(__dirname, ...)` sprinkled through a file; it can rewrite one known line.
 *
 * Everything else is reported and left alone, because it changes behaviour rather than
 * syntax:
 *
 *   require() of package.json  an import attribute, a runtime read, or a build constant
 *   module.exports             a named or a default export, but which
 *   module-scope await         breaks require(esm) for every CJS consumer downstream
 *
 * Any other require() is mechanical: createRequire keeps the call synchronous and the
 * specifier opaque, which is faithful in every context. `await import()` is often nicer,
 * but it needs the call site to be async and the target to exist as .js - and while a
 * package's tests still run its .ts sources through tsx, it does not.
 *
 * The tool refuses rather than guesses: a mocha config it does not recognise is reported, not
 * rewritten.
 */

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { shippedDirsOf, SOURCE_ROOTS } from "../../shared/shipped_dirs.mjs";
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
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return out;
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
 * converted, rebuilt and tested without anyone reading it.
 */
export function survey({ repoRoot = "." } = {}) {
    const packages = allPackages(repoRoot).map((name) => analyze({ repoRoot, packageName: name }));
    return {
        total: packages.length,
        alreadyEsm: packages.filter((p) => p.alreadyEsm),
        mechanical: packages.filter((p) => !p.alreadyEsm && p.manual.length === 0),
        needsDecision: packages.filter((p) => !p.alreadyEsm && p.manual.length > 0),
        packages
    };
}

export function analyze({ repoRoot = ".", packageName } = {}) {
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

    return {
        found: true,
        packageName,
        dir: dir.replace(/\\/g, "/"),
        alreadyEsm,
        mocharc: rename ? "rename" : "none",
        anchors,
        dynamicRequires,
        manual
    };
}
