/**
 * rule - an assertion must not sit behind an optional chain.
 *
 *     alarm.shelvingState?.getCurrentState().should.eql("Unshelved");
 *
 * `?.` short-circuits the WHOLE chain, not just the link it is written on. If
 * `shelvingState` is undefined the expression evaluates to undefined and stops - the
 * `.should` is never reached, no assertion runs, and the test passes. It reads as if it had
 * checked something, and it is exactly the case where the check mattered.
 *
 * The fix is `!` rather than `?`:
 *
 *     alarm.shelvingState!.getCurrentState().should.eql("Unshelved");
 *
 * `!` is erased at run time, so this is plain `.` - a missing `shelvingState` now throws a
 * TypeError and the test fails, which is what a test is for. Where the value really may be
 * absent, assert that first, or wrap the value instead of the chain:
 *
 *     should.exist(alarm.shelvingState);
 *     should(alarm.shelvingState?.getCurrentState()).eql("Unshelved");
 *
 * `should(x)` takes the whole chain as an argument, so undefined reaches the assertion
 * rather than skipping it.
 *
 * Only chains ending at `.should` are flagged. `a?.b` on its own is ordinary code.
 */

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

/** opt out on one line, with a reason: `// check-short-circuit-assertion: ok - why` */
export const IGNORE_MARKER = "check-short-circuit-assertion: ok";

export const SOURCE_ROOTS = ["packages", "packages_extra"];

const SKIP_DIRS = new Set(["node_modules", "dist", "dist-esm", "distNodeJS", "distHelpers", "coverage", "build"]);

/**
 * The chain of accesses by which the assertion reaches its subject, outermost first.
 *
 * Only these links matter. A `?.` inside an argument does not short-circuit the assertion -
 * `foo(a?.b).should.eql(1)` calls foo with undefined and then asserts perfectly well - and a
 * `!` inside one is load-bearing, because removing it changes the type the argument is
 * checked against. Parentheses are not followed either: `(a?.b).c` throws rather than
 * short-circuiting, so the chain genuinely ends there.
 */
function spine(node) {
    const out = [];
    let n = node;
    while (n) {
        out.push(n);
        if (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n) || ts.isCallExpression(n) || ts.isNonNullExpression(n)) {
            n = n.expression;
        } else {
            break;
        }
    }
    return out;
}

/** an optional link on the chain that reaches the subject */
export function hasOptionalLink(node) {
    return spine(node).some(
        (n) => (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n) || ts.isCallExpression(n)) && n.questionDotToken
    );
}

/** every `!` on the chain that reaches the subject */
function spineNonNulls(node) {
    return node ? spine(node).filter((n) => ts.isNonNullExpression(n)) : [];
}

const parse = (text, filePath) => ts.createSourceFile(filePath, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);

/**
 * Violations in one file's text.
 *
 * Returns [{ line, text, subjectStart, subjectEnd, end }], 1-based lines. The three offsets
 * describe the rewrite: `[subjectStart, subjectEnd)` is the value being asserted on, and
 * `[subjectStart, end)` is that value together with the `.should` that follows it.
 */
export function findViolations(text, filePath) {
    const sf = parse(text, filePath);
    const lines = text.split("\n");
    const out = [];
    const visit = (node) => {
        if (ts.isPropertyAccessExpression(node) && node.name.text === "should") {
            // `a?.b.should` carries the token inside the subject; `a.b?.should` carries it on
            // the `.should` access itself. Both stop the assertion, so both count.
            //
            // A `!` in the subject counts too. It does not silence the assertion the way `?.`
            // does - it throws a bare TypeError instead, with no expected value in it - and
            // it is only allowed here at all because biome.json switches noNonNullAssertion
            // off under test/. `should(subject)` needs neither.
            const nonNull = spineNonNulls(node.expression);
            if (hasOptionalLink(node.expression) || node.questionDotToken || nonNull.length) {
                const { line } = ts.getLineAndCharacterOfPosition(sf, node.getStart(sf));
                if (!(lines[line] ?? "").includes(IGNORE_MARKER)) {
                    out.push({
                        line: line + 1,
                        text: (lines[line] ?? "").trim().slice(0, 110),
                        subjectStart: node.expression.getStart(sf),
                        subjectEnd: node.expression.getEnd(),
                        end: node.getEnd()
                    });
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(sf, visit);
    return out;
}

/**
 * How this file gets at `should`, and where an import could be added.
 *
 * `should(x)` needs the value, and a test that only ever wrote `x.should` may well have
 * imported the module for its side effect alone.
 */
function shouldBinding(sf) {
    let sideEffectOnly = null;
    let lastImportEnd = 0;
    for (const st of sf.statements) {
        if (!ts.isImportDeclaration(st)) continue;
        lastImportEnd = st.getEnd();
        if (!ts.isStringLiteral(st.moduleSpecifier) || st.moduleSpecifier.text !== "should") continue;
        if (!st.importClause) {
            sideEffectOnly = st;
            continue;
        }
        if (st.importClause.name) return { kind: "default", lastImportEnd };
        // `import * as should` gives a namespace object, which is not callable
        if (st.importClause.namedBindings && ts.isNamespaceImport(st.importClause.namedBindings)) {
            return { kind: "namespace", lastImportEnd };
        }
    }
    return { kind: sideEffectOnly ? "side-effect" : "absent", sideEffectOnly, lastImportEnd };
}

/** does anything in this file already bind the name `should` to something else? */
function shadowsShould(sf) {
    let shadowed = false;
    const visit = (n) => {
        if (shadowed) return;
        const isBinding =
            (ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) &&
            n.name &&
            ts.isIdentifier(n.name) &&
            n.name.text === "should";
        if (isBinding) {
            shadowed = true;
            return;
        }
        ts.forEachChild(n, visit);
    };
    ts.forEachChild(sf, visit);
    return shadowed;
}

/**
 * The subject, with every `!` in it turned back into the `?.` it was hiding.
 *
 * A `!` says "trust me, not null" and throws when that is wrong. Inside `should(...)` the
 * honest form is `?.`, which lets undefined through to the assertion so the failure names
 * the expected value instead of being a TypeError. What the `!` becomes depends on what
 * follows it, since `a!.b` already has a dot to reuse while `f!()` and `a![0]` do not:
 *
 *     a!.b   -> a?.b        the `!` becomes the `?` of `?.`
 *     f!()   -> f?.()       there is no dot, so the `!` becomes `?.`
 *     a![0]  -> a?.[0]      likewise
 *     a.b!   -> a.b         nothing follows it; the `.should` it guarded is going away
 */
function subjectText(text, sf, violation) {
    const sub = { start: violation.subjectStart, end: violation.subjectEnd };
    const node = findNodeAt(sf, sub.start, sub.end);
    const edits = [];
    for (const nn of spineNonNulls(node)) {
        const bang = nn.getEnd() - 1;
        if (bang < sub.start || bang >= sub.end) continue;
        const parent = nn.parent;
        if (parent && ts.isPropertyAccessExpression(parent) && parent.expression === nn && parent.getEnd() <= sub.end) {
            // absorb the dot rather than only replacing the `!`: a chain that wraps puts the
            // dot on the next line, and `?` + newline + `.` is a conditional operator, not
            // `?.` - "error TS1109: Expression expected"
            const dot = text.indexOf(".", bang + 1);
            edits.push({ start: bang, end: dot + 1, replacement: "?." });
        } else if (
            parent &&
            (ts.isCallExpression(parent) || ts.isElementAccessExpression(parent)) &&
            parent.expression === nn &&
            parent.getEnd() <= sub.end
        ) {
            edits.push({ start: bang, end: bang + 1, replacement: "?." });
        } else {
            // nothing follows it; the `.should` it was guarding is going away
            edits.push({ start: bang, end: bang + 1, replacement: "" });
        }
    }
    edits.sort((a, b) => b.start - a.start);
    let out = text.slice(sub.start, sub.end);
    for (const e of edits) {
        out = out.slice(0, e.start - sub.start) + e.replacement + out.slice(e.end - sub.start);
    }
    return out;
}

/** the innermost node spanning exactly this range */
function findNodeAt(sf, start, end) {
    let best = null;
    const visit = (n) => {
        if (n.getStart(sf) === start && n.getEnd() === end) best = n;
        if (n.getStart(sf) <= start && n.getEnd() >= end) ts.forEachChild(n, visit);
    };
    ts.forEachChild(sf, visit);
    return best;
}

/**
 * Rewrite `subject.should.rest` as `should(subject).rest`, keeping the optional chain.
 *
 * The point is not to remove the `?.` but to move it inside the call. `should(x)` takes the
 * value as an argument, so an undefined reaches the assertion and fails it with a message,
 * where `x?.should` would have skipped it silently and `x!.should` would have thrown a bare
 * TypeError. It also needs no `!`, which the repo's biome config has to switch off for
 * tests.
 *
 * Returns { text, fixed, skipped }.
 */
export function fixText(text, filePath) {
    const violations = findViolations(text, filePath);
    if (!violations.length) return { text, fixed: 0, skipped: 0 };

    const sf = parse(text, filePath);
    if (shadowsShould(sf)) {
        // rewriting here would call whatever local `should` is, not the assertion library
        return { text, fixed: 0, skipped: violations.length };
    }
    const binding = shouldBinding(sf);
    if (binding.kind === "namespace") {
        // `import * as should` is not callable; leave it for a person to look at
        return { text, fixed: 0, skipped: violations.length };
    }

    // outermost first, so a nested `.should` inside a subject is dropped rather than
    // producing overlapping edits
    const sorted = [...violations].sort((a, b) => a.subjectStart - b.subjectStart || b.end - a.end);
    const chosen = [];
    let coveredTo = -1;
    for (const v of sorted) {
        if (v.subjectStart < coveredTo) continue;
        chosen.push(v);
        coveredTo = v.end;
    }

    const edits = chosen.map((v) => ({
        start: v.subjectStart,
        end: v.end,
        replacement: `should(${subjectText(text, sf, v)})`
    }));

    if (binding.kind === "side-effect") {
        const st = binding.sideEffectOnly;
        edits.push({ start: st.getStart(sf), end: st.getEnd(), replacement: `import should from "should";` });
    } else if (binding.kind === "absent") {
        const at = binding.lastImportEnd;
        edits.push({ start: at, end: at, replacement: `\nimport should from "should";` });
    }

    edits.sort((a, b) => b.start - a.start || b.end - a.end);
    let out = text;
    for (const e of edits) {
        out = out.slice(0, e.start) + e.replacement + out.slice(e.end);
    }
    return { text: out, fixed: chosen.length, skipped: violations.length - chosen.length };
}

export function findFiles(repoRoot = ".", packageFilter) {
    const out = [];
    const walk = (dir) => {
        if (!fs.existsSync(dir)) return;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name).replace(/\\/g, "/");
            if (e.isDirectory()) {
                if (!SKIP_DIRS.has(e.name)) walk(full);
            } else if (/\.(ts|mts|cts)$/.test(e.name) && !e.name.endsWith(".d.ts")) {
                out.push(full);
            }
        }
    };
    for (const root of SOURCE_ROOTS) {
        const full = path.join(repoRoot, root);
        if (!fs.existsSync(full)) continue;
        for (const pkg of fs.readdirSync(full, { withFileTypes: true })) {
            if (!pkg.isDirectory() || SKIP_DIRS.has(pkg.name)) continue;
            if (packageFilter && pkg.name !== packageFilter) continue;
            walk(path.join(full, pkg.name).replace(/\\/g, "/"));
        }
    }
    return out;
}

export function analyze({ repoRoot = ".", packageFilter, write = false } = {}) {
    const files = findFiles(repoRoot, packageFilter);
    const findings = [];
    let fixedCount = 0;
    let fixedFiles = 0;

    for (const file of files) {
        const original = fs.readFileSync(file, "utf8");
        let current = original;
        if (write) {
            const { text, fixed } = fixText(original, file);
            if (fixed > 0) {
                fs.writeFileSync(file, text);
                fixedCount += fixed;
                fixedFiles++;
                current = text;
            }
        }
        for (const v of findViolations(current, file)) {
            findings.push({ file: file.replace(/\\/g, "/"), ...v });
        }
    }
    return { scanned: files.length, findings, fixedCount, fixedFiles };
}

export function exitCode(result) {
    return result.findings.length > 0 ? 1 : 0;
}

export function formatReport(result) {
    const lines = [];
    if (result.fixedFiles > 0) {
        lines.push(`check-short-circuit-assertion: rewrote ${result.fixedCount} chains in ${result.fixedFiles} files`, "");
    }
    if (result.findings.length === 0) {
        lines.push(`check-short-circuit-assertion: ${result.scanned} files scanned, no assertion sits behind an optional chain.`);
        return lines.join("\n");
    }
    const byPackage = new Map();
    for (const f of result.findings) {
        const pkg = f.file.split("/").slice(0, 2).join("/");
        byPackage.set(pkg, (byPackage.get(pkg) ?? 0) + 1);
    }
    lines.push(`check-short-circuit-assertion: ${result.findings.length} assertion(s) an optional chain can switch off, in ${result.scanned} files`, "");
    for (const [pkg, n] of [...byPackage].sort((a, b) => b[1] - a[1])) {
        lines.push(`  ${String(n).padStart(5)}  ${pkg}`);
    }
    lines.push("");
    for (const f of result.findings.slice(0, 30)) {
        lines.push(`    ${f.file}:${f.line}  ${f.text}`);
    }
    if (result.findings.length > 30) {
        lines.push(`    ... and ${result.findings.length - 30} more`);
    }
    lines.push("");
    lines.push("`?.` short-circuits the whole chain, so a null skips the assertion and the test");
    lines.push("passes without checking anything. --fix rewrites `?.` to `!.`, which is erased at");
    lines.push("run time and therefore throws instead. Where the value really may be absent, wrap");
    lines.push("it rather than the chain: should(a?.b).eql(x) passes undefined to the assertion.");
    return lines.join("\n");
}
