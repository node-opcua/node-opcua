/**
 * rule - TypeScript syntax in a test file that Node's type stripping cannot erase.
 *
 * The suite runs on Node's own type stripping rather than tsx (NATIVE_TS in
 * packages/run_all_mocha_tests.js). Stripping replaces type syntax with whitespace of the
 * same length and never emits anything, so any construct that has to *produce* JavaScript
 * is rejected outright with ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX - at load time, before a
 * single test in the file runs.
 *
 * That constraint is a property of the runtime, not a style preference, and nothing else
 * enforces it. Ten test files had to be rewritten to adopt native stripping; without a gate
 * the next `enum` added to a test would break the run and the failure would surface as a
 * file that will not load rather than as a rule anyone knew about.
 *
 * The five constructs below are not a reading of TypeScript's `erasableSyntaxOnly`: that
 * flag permits angle-bracket assertions, and Node rejects them. They were established by
 * running each shape through `node --experimental-strip-types` and recording what it
 * refused, which is the only authority that matters here.
 *
 * Scope is test trees only. Library source is reached through its compiled dist - the
 * NATIVE_TS resolver prefers `pkg/dist/<rel>` for a relative `.js` specifier and falls back
 * to the `.ts` only when no dist exists - so source is plain JavaScript by the time the
 * runner sees it and is never stripped. That is why the 264 enum declarations in source
 * are not a problem and are deliberately not reported: covering them would force hundreds
 * of rewrites for no runtime reason. The fallback does fire on a clean checkout where
 * `build:all` has not run, but that is a build-order problem, not a syntax one.
 *
 * Parser-based rather than regex-based, like its sibling gates: `enum` and `namespace` are
 * ordinary words in prose, `<T>x` is indistinguishable from a comparison without a parse,
 * and `private` appears in plenty of declarations that are not parameter properties.
 */

import fs from "node:fs";
import path from "node:path";
// the classic compiler API, which TypeScript 7 no longer exposes: an aliased 5.x copy
import ts from "typescript-5";
import { TEST_DIRS } from "../../shared/test_dirs.mjs";

export { TEST_DIRS };

/** opt out on one line, with a reason: `// check-erasable: ok - why` */
export const IGNORE_MARKER = "check-erasable: ok";

const SKIP_DIRS = new Set(["node_modules", "dist", "dist-esm", "coverage", "build"]);

/** parameter-property modifiers: these emit an assignment into the constructor body */
const PARAMETER_PROPERTY_MODIFIERS = new Set([
    ts.SyntaxKind.PublicKeyword,
    ts.SyntaxKind.PrivateKeyword,
    ts.SyntaxKind.ProtectedKeyword,
    ts.SyntaxKind.ReadonlyKeyword
]);

/** what each kind should become, shown in the report so the fix is not a research task */
export const REMEDIES = {
    enum: "a `const` object with `as const`, plus a type alias of the same name",
    namespace: "a module, or a plain exported object",
    "param-property": "an explicit field declaration and an assignment in the constructor body",
    "angle-cast": "`expr as T`",
    "import=": "a standard `import`",
    "export=": "`export default`, or named exports"
};

const isDeclared = (node) => node.modifiers?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword);

/**
 * Which non-erasable construct this node is, or undefined.
 *
 * `declare` forms are erasable: they emit nothing by definition. A module declaration whose
 * name is a string literal is an ambient module (`declare module "x"`), likewise type-only.
 */
function kindOf(node) {
    if (ts.isEnumDeclaration(node) && !isDeclared(node)) {
        return "enum";
    }
    if (ts.isModuleDeclaration(node) && node.body && !isDeclared(node) && !ts.isStringLiteral(node.name)) {
        return "namespace";
    }
    if (ts.isImportEqualsDeclaration(node)) {
        return "import=";
    }
    if (ts.isExportAssignment(node) && node.isExportEquals) {
        return "export=";
    }
    if (ts.isParameter(node) && node.modifiers?.some((m) => PARAMETER_PROPERTY_MODIFIERS.has(m.kind))) {
        return "param-property";
    }
    if (node.kind === ts.SyntaxKind.TypeAssertionExpression) {
        return "angle-cast";
    }
    return undefined;
}

/** Violations in one file's text, as [{ line, kind, text, ignored }]. */
export function findViolations(text, filePath = "file.ts") {
    const scriptKind = /\.tsx$/.test(filePath) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(filePath, text, ts.ScriptTarget.ESNext, true, scriptKind);
    const lines = text.split("\n");
    const out = [];

    const visit = (node) => {
        const kind = kindOf(node);
        if (kind) {
            const { line } = ts.getLineAndCharacterOfPosition(sf, node.getStart(sf));
            out.push({
                line: line + 1,
                kind,
                text: (lines[line] ?? "").trim().slice(0, 100),
                ignored: (lines[line] ?? "").includes(IGNORE_MARKER)
            });
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return out;
}

/** every .ts under a package's test trees */
export function findTestFiles(repoRoot = ".", packageFilter) {
    const packagesDir = path.join(repoRoot, "packages");
    let packages;
    try {
        packages = fs.readdirSync(packagesDir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out = [];
    for (const entry of packages) {
        if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) {
            continue;
        }
        if (packageFilter && entry.name !== packageFilter) {
            continue;
        }
        for (const testDir of TEST_DIRS) {
            collect(path.join(packagesDir, entry.name, testDir), out);
        }
    }
    return out.sort();
}

function collect(dir, out) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) {
                collect(full, out);
            }
        } else if (/\.(ts|mts|cts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
            out.push(full);
        }
    }
}

export function analyze({ repoRoot = ".", packageFilter } = {}) {
    const files = findTestFiles(repoRoot, packageFilter);
    const findings = [];
    let exempt = 0;

    for (const file of files) {
        for (const v of findViolations(fs.readFileSync(file, "utf8"), file)) {
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
        return `check-erasable: ${result.scanned} test files scanned${exemptNote}, all erasable.`;
    }
    const lines = [
        `check-erasable: ${result.findings.length} non-erasable construct(s), in ${result.scanned} test files scanned${exemptNote}`,
        ""
    ];
    for (const f of result.findings) {
        lines.push(`    ${f.file}:${f.line}  ${f.kind}  ${f.text}`);
    }
    const kinds = [...new Set(result.findings.map((f) => f.kind))].sort();
    lines.push("", "Node's type stripping erases type syntax and emits nothing, so each of these is", "rejected at load time with ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX. Write instead:", "");
    for (const kind of kinds) {
        lines.push(`    ${kind.padEnd(15)} ${REMEDIES[kind]}`);
    }
    lines.push(
        "",
        `If a case is genuinely unavoidable, put \`// ${IGNORE_MARKER} - <reason>\` on the line,`,
        "knowing the file will not load under NATIVE_TS."
    );
    return lines.join("\n");
}
