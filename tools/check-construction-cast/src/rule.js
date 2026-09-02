/**
 * rule - an implementation class is published as itself, not through a constructor cast.
 *
 * The shape this rejects:
 *
 *     export type UAConditionImpl = UAConditionImplBase & UAConditionEx;
 *     export const UAConditionImpl = UAConditionImplBase as unknown as new () => UAConditionImpl;
 *
 * It appears when a class cannot state that it implements its own published interface,
 * usually because the address space installs its child nodes at run time and the class
 * never declares them. The cast then asserts the class is something the compiler cannot
 * check, and the two drift: node-opcua-address-space had fifteen of these, and behind them
 * a class whose declared base was wrong (a Transition typed as a bare BaseNode rather than
 * the UAObject it is), an alarm requiring a property its own interface made optional, and a
 * method returning a wider type than the interface promised. None of that was visible while
 * the cast stood between them.
 *
 * The fix is nearly always `declare` fields for the child nodes, plus `implements`. Note
 * that `declare` is not merely a type-level convenience here: with `useDefineForClassFields`
 * (the default from target es2022) a plain field would define the property as undefined in
 * the constructor and clobber the real node.
 *
 * Parser-based rather than regex-based, because the target is a type-level construct: only
 * an `as` whose target is a constructor type counts, and `new ()` inside a string or a
 * comment must not.
 */

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { shippedDirsOf, SOURCE_ROOTS } from "../../shared/shipped_dirs.mjs";

export { SOURCE_ROOTS };

/** opt out on one line, with a reason: `// check-construction-cast: ok - why` */
export const IGNORE_MARKER = "check-construction-cast: ok";

/** the conventional layout, used only when a package does not say what it publishes */
export const SOURCE_DIRS = ["source", "src"];

const SKIP_DIRS = new Set(["node_modules", "dist", "dist-esm", "coverage", "build"]);

/**
 * Violations in one file's text, as [{ line, text, ignored }].
 *
 * A violation is an `as` expression whose target type is a constructor type, which is what
 * "publish this class as something else" looks like. `x as SomeInterface` is left alone:
 * plenty of those are ordinary narrowing, and this rule is about the construction path.
 */
export function findViolations(text, filePath = "file.ts") {
    // cheap reject before paying for a parse
    if (!text.includes("new ")) {
        return [];
    }
    const sf = ts.createSourceFile(filePath, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
    const lines = text.split("\n");
    const out = [];

    const visit = (node) => {
        if (ts.isAsExpression(node) && ts.isConstructorTypeNode(node.type)) {
            const { line } = ts.getLineAndCharacterOfPosition(sf, node.getStart(sf));
            // the marker may sit on the reported line or on any line the expression spans
            const { line: endLine } = ts.getLineAndCharacterOfPosition(sf, node.getEnd());
            let ignored = false;
            for (let i = Math.max(0, line - 1); i <= endLine && i < lines.length; i++) {
                if (lines[i].includes(IGNORE_MARKER)) {
                    ignored = true;
                    break;
                }
            }
            out.push({
                line: line + 1,
                text: (lines[line] ?? "").trim().slice(0, 100),
                ignored
            });
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
        return `check-construction-cast: ${result.scanned} files scanned${exemptNote}, no class is published through a constructor cast.`;
    }
    const lines = [
        `check-construction-cast: ${result.findings.length} class(es) published through a constructor cast, in ${result.scanned} files scanned${exemptNote}`,
        ""
    ];
    for (const f of result.findings) {
        lines.push(`    ${f.file}:${f.line}  ${f.text}`);
    }
    lines.push(
        "",
        "A cast to a constructor type asserts that a class is something the compiler",
        "cannot check, so the class and the interface it claims are free to drift.",
        "Declare the child nodes the address space installs - `declare` emits nothing,",
        "which is what you want, since a plain field would define them as undefined in",
        "the constructor - then say `implements` and export the class itself.",
        "",
        `If a class genuinely cannot satisfy one interface - it serves two that disagree,`,
        `say - keep the cast and give it a reason: // ${IGNORE_MARKER} - why`
    );
    return lines.join("\n");
}
