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
const ANCHOR = /^(\s*(?:export\s+)?const\s+[A-Za-z_$][\w$]*\s*=\s*)(__dirname|__filename)(\s*;)/gm;

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
 * The mocha config, from CJS to ESM. Recognises the two shapes this repository uses and
 * refuses anything else - a config it does not understand is reported, not rewritten.
 */
export function convertMocharc(text) {
    if (!text.includes("module.exports")) return null;
    // constructs whose ESM form is not a mechanical substitution
    if (/\bexports\.\w/.test(text) || /\b__dirname\b|\b__filename\b/.test(text)) return null;

    let out = text.replace(/module\.exports\s*=/, "export default");

    const needsRequire = /\brequire\s*(\.resolve)?\s*\(/.test(out);
    if (needsRequire) {
        const preamble =
            'import { createRequire } from "node:module";\n\n' +
            "// `require` and `require.resolve` do not exist in an ES module. The absolute paths they\n" +
            "// produce are still the point: mocha resolves bare `require` entries from its own install\n" +
            "// directory, not the working directory, which breaks under pnpm's layout.\n" +
            "const require = createRequire(import.meta.url);\n\n";
        // after the leading comment block, so the file still reads top-down
        const firstCode = out.search(/^(?!\s*(\/\/|\/\*|\*|$))/m);
        out = firstCode <= 0 ? preamble + out : out.slice(0, firstCode) + preamble + out.slice(firstCode);
    }
    return out;
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

/** `const here = __dirname;` -> `const here = import.meta.dirname;`, and drop the stale note */
export function convertAnchors(text) {
    if (!ANCHOR.test(text)) {
        ANCHOR.lastIndex = 0;
        return null;
    }
    ANCHOR.lastIndex = 0;
    let out = text.replace(ANCHOR, (_m, head, name, tail) => `${head}import.meta.${name === "__dirname" ? "dirname" : "filename"}${tail}`);
    out = out.replace(ANCHOR_COMMENT, "");
    return out;
}

// ── the half that needs a person ────────────────────────────────────────────────

/** things whose ESM form changes behaviour, so the tool reports rather than rewrites */
export function findManualWork(text, filePath = "file.ts") {
    if (!text.includes("require") && !text.includes("await") && !text.includes("module.exports")) return [];
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
        mechanical: packages.filter((p) => !p.alreadyEsm && p.manual.length === 0 && p.mocharc !== "unrecognised"),
        needsDecision: packages.filter((p) => !p.alreadyEsm && (p.manual.length > 0 || p.mocharc === "unrecognised")),
        packages
    };
}

export function analyze({ repoRoot = ".", packageName } = {}) {
    const dir = packageDir(repoRoot, packageName);
    if (!dir) return { found: false, packageName };

    const manifestPath = path.join(dir, "package.json");
    const manifest = fs.readFileSync(manifestPath, "utf8");
    const alreadyEsm = /"type"\s*:\s*"module"/.test(manifest);

    const mocharcPath = path.join(dir, ".mocharc.js");
    const hasMocharc = fs.existsSync(mocharcPath);
    const mocharcConvertible = hasMocharc ? convertMocharc(fs.readFileSync(mocharcPath, "utf8")) !== null : false;

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
        mocharc: hasMocharc ? (mocharcConvertible ? "convertible" : "unrecognised") : "none",
        anchors,
        dynamicRequires,
        manual
    };
}
