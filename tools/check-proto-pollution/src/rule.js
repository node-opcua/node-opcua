/**
 * rule - flag computed-key assignments that can write "__proto__" / "constructor" / "prototype".
 *
 *     obj[fieldName] = value;
 *
 * When `fieldName` is a plain string, `obj[fieldName] = value` reads like an ordinary property
 * write. It is not, when the string can be "__proto__": that spelling does not create a data
 * property at all, it invokes [[SetPrototypeOf]]. If `obj` is a class instance the write silently
 * reparents it (methods vanish, `instanceof` breaks - a per-instance denial of service). If `obj`
 * is a plain object used as a lookup map - a decoder building { [name]: value } from wire data -
 * the write reaches Object.prototype itself and pollutes every object in the process.
 *
 * This is exactly the class of bug fixed in GHSA-vjmq-2f58-rg3x: a StructureField name taken
 * from a NodeSet/wire message was used as a dynamic property key with no check. The reference
 * fix is packages/node-opcua-schemas/source/dynamic_extension_object.ts's setFieldValue(), which
 * writes through Object.defineProperty instead of `obj[name] =`, and
 * packages/node-opcua-client-dynamic-extension-object/source/convert_data_type_definition_to_structuretype_schema.ts's
 * createField(), which rejects "__proto__"/"constructor"/"prototype" before the field is ever used
 * as a key.
 *
 * This rule cannot know, from syntax alone, which computed keys are attacker-reachable and which
 * are internal enum values - that needs the taint tracing a person does in review. So it flags
 * every non-literal computed-key WRITE it finds (minus the narrow, high-confidence safe patterns
 * below) and relies on a baseline (tools/proto-pollution-baseline.json) to separate "already
 * triaged, accepted" from "new - look at this before merging". A PR that adds a new one fails
 * check:protopollution until it's fixed or the baseline is updated with --update (which is itself
 * a reviewable diff).
 *
 * Recognized safe patterns (not flagged):
 *   - the key is a string/numeric/no-substitution-template literal - not computed at all.
 *   - the key is a `for (let i = 0; ...; i++)` loop counter used as an array index.
 *   - the object was declared `= Object.create(null)` (or `Object.create(null) as ...`) in the
 *     same file - no prototype to pollute.
 *   - the key is denylist-checked against "__proto__"/"constructor"/"prototype" earlier in the
 *     same block (an `if` that returns/continues/throws, or a `&&`/`||` guard on the assignment
 *     itself) - the exact shape of the reference fix.
 *   - the write goes through `Object.defineProperty(...)` or a `Map`/`Set`/`WeakMap`/`WeakSet`
 *     `.set(...)`/`.add(...)` call - different syntax, not matched by this rule at all.
 *
 * Opt out on one line, with a reason: `// check-proto-pollution: ok - why`
 */

import fs from "node:fs";
import path from "node:path";
// the classic compiler API, which TypeScript 7 no longer exposes: an aliased 5.x copy
import ts from "typescript-5";

export const IGNORE_MARKER = "check-proto-pollution: ok";

export const SOURCE_ROOTS = ["packages", "packages_extra"];

const SKIP_DIRS = new Set(["node_modules", "dist", "dist-esm", "distNodeJS", "distHelpers", "coverage", "build", "generated"]);
const SKIP_PATH_SEGMENTS = ["/test/", "/tests/", "/fixtures/", "/examples/", "/example/", "/benchmark/", "/bin/"];
const SKIP_FILE_SUFFIXES = [".d.ts", "_enum.ts"];
const SKIP_FILE_INFIXES = ["nodeids"];

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const ASSIGNMENT_OPERATORS = new Set([
    ts.SyntaxKind.EqualsToken,
    ts.SyntaxKind.PlusEqualsToken,
    ts.SyntaxKind.MinusEqualsToken,
    ts.SyntaxKind.AsteriskEqualsToken,
    ts.SyntaxKind.SlashEqualsToken,
    ts.SyntaxKind.QuestionQuestionEqualsToken,
    ts.SyntaxKind.BarBarEqualsToken,
    ts.SyntaxKind.AmpersandAmpersandEqualsToken
]);

const parse = (text, filePath) => ts.createSourceFile(filePath, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);

/** true if this key expression can never be "__proto__"/"constructor"/"prototype" */
function isLiteralKey(node) {
    if (ts.isStringLiteralLike(node)) return true;
    if (ts.isNumericLiteral(node)) return true;
    if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) return true;
    return false;
}

/** `for (let i = 0; i < n; i++) arr[i] = ...` - i is a numeric loop counter, not attacker data */
function isForLoopCounter(keyNode, sf) {
    if (!ts.isIdentifier(keyNode)) return false;
    const name = keyNode.text;
    let n = keyNode.parent;
    while (n) {
        if (ts.isForStatement(n) && n.initializer) {
            const init = n.initializer;
            if (ts.isVariableDeclarationList(init)) {
                for (const decl of init.declarations) {
                    if (
                        ts.isIdentifier(decl.name) &&
                        decl.name.text === name &&
                        decl.initializer &&
                        ts.isNumericLiteral(decl.initializer)
                    ) {
                        return true;
                    }
                }
            }
        }
        n = n.parent;
    }
    return false;
}

/** the object expression was declared `= Object.create(null)` somewhere in this file */
function buildNullProtoVars(sf) {
    const vars = new Set();
    const visit = (n) => {
        if (ts.isVariableDeclaration(n) && n.initializer && ts.isIdentifier(n.name)) {
            const init = n.initializer;
            const target = ts.isAsExpression(init) || ts.isSatisfiesExpression(init) ? init.expression : init;
            if (
                ts.isCallExpression(target) &&
                ts.isPropertyAccessExpression(target.expression) &&
                target.expression.name.text === "create" &&
                ts.isIdentifier(target.expression.expression) &&
                target.expression.expression.text === "Object" &&
                target.arguments.length >= 1 &&
                target.arguments[0].kind === ts.SyntaxKind.NullKeyword
            ) {
                vars.add(n.name.text);
            }
        }
        ts.forEachChild(n, visit);
    };
    ts.forEachChild(sf, visit);
    return vars;
}

function objectRootIdentifier(node) {
    let n = node;
    while (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n) || ts.isNonNullExpression(n)) {
        n = n.expression;
    }
    return ts.isIdentifier(n) ? n.text : null;
}

/** does the text of `node` mention the key identifier alongside a dangerous-key literal? */
function textGuardsKey(node, keyName, text) {
    const slice = text.slice(node.getStart(), node.getEnd());
    if (!keyName || !slice.includes(keyName)) return false;
    return [...DANGEROUS_KEYS].some((k) => slice.includes(`"${k}"`) || slice.includes(`'${k}'`));
}

/**
 * A denylist check on the key sits earlier in the same block, or guards the assignment's own
 * statement (`if (DANGEROUS.includes(key)) continue; obj[key] = v;` or
 * `if (key !== "__proto__") obj[key] = v;`).
 */
function isGuardedByDenylistCheck(assignStmt, keyNode, text) {
    if (!ts.isIdentifier(keyNode)) return false;
    const keyName = keyNode.text;

    // guard as the condition of an enclosing if/conditional
    let n = assignStmt;
    while (n) {
        const p = n.parent;
        if (p && ts.isIfStatement(p) && p.thenStatement === n && textGuardsKey(p.expression, keyName, text)) {
            return true;
        }
        if (ts.isConditionalExpression(n) && textGuardsKey(n.condition, keyName, text)) return true;
        n = p;
    }

    // an earlier sibling statement in the same block (or at the top level of the file)
    // denylist-checks the key and returns/throws/continues
    const container = assignStmt.parent;
    if (container && (ts.isBlock(container) || ts.isSourceFile(container))) {
        for (const stmt of container.statements) {
            if (stmt === assignStmt || stmt.getStart() >= assignStmt.getStart()) break;
            if (
                ts.isIfStatement(stmt) &&
                textGuardsKey(stmt.expression, keyName, text) &&
                stmt.thenStatement &&
                /return|throw|continue|break/.test(stmt.thenStatement.getText())
            ) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Violations in one file's text.
 *
 * Returns [{ line, text, keyText, objText }], 1-based lines.
 */
export function findViolations(text, filePath) {
    const sf = parse(text, filePath);
    const lines = text.split("\n");
    const nullProtoVars = buildNullProtoVars(sf);
    const out = [];

    const visit = (node) => {
        if (
            ts.isBinaryExpression(node) &&
            ASSIGNMENT_OPERATORS.has(node.operatorToken.kind) &&
            ts.isElementAccessExpression(node.left)
        ) {
            const access = node.left;
            const keyNode = access.argumentExpression;

            if (!isLiteralKey(keyNode) && !isForLoopCounter(keyNode, sf)) {
                const rootId = objectRootIdentifier(access.expression);
                const isNullProto = rootId && nullProtoVars.has(rootId);
                const assignStmt = ts.findAncestor(node, ts.isExpressionStatement) ?? node;

                if (!isNullProto && !isGuardedByDenylistCheck(assignStmt, keyNode, text)) {
                    const { line } = ts.getLineAndCharacterOfPosition(sf, node.getStart(sf));
                    if (!(lines[line] ?? "").includes(IGNORE_MARKER)) {
                        out.push({
                            line: line + 1,
                            text: (lines[line] ?? "").trim().slice(0, 130),
                            keyText: keyNode.getText(sf).slice(0, 60),
                            objText: access.expression.getText(sf).slice(0, 60)
                        });
                    }
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(sf, visit);
    return out;
}

export function findFiles(repoRoot = ".", packageFilter) {
    const out = [];
    const walk = (dir) => {
        if (!fs.existsSync(dir)) return;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name).replace(/\\/g, "/");
            if (e.isDirectory()) {
                if (!SKIP_DIRS.has(e.name)) walk(full);
            } else if (/\.(ts|mts|cts)$/.test(e.name)) {
                if (SKIP_FILE_SUFFIXES.some((s) => e.name.endsWith(s))) continue;
                if (SKIP_FILE_INFIXES.some((s) => e.name.includes(s))) continue;
                if (SKIP_PATH_SEGMENTS.some((s) => full.includes(s))) continue;
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

/** stable key for the baseline file: survives line shifts from unrelated edits above it */
function baselineKey(file, finding) {
    return `${file}::${finding.objText}[${finding.keyText}]`;
}

export function analyze({ repoRoot = ".", packageFilter } = {}) {
    const files = findFiles(repoRoot, packageFilter);
    const findings = [];
    for (const file of files) {
        const text = fs.readFileSync(file, "utf8");
        for (const v of findViolations(text, file)) {
            findings.push({ file: file.replace(/\\/g, "/"), ...v });
        }
    }
    return { scanned: files.length, findings };
}

export function currentBaseline(result) {
    const baseline = {};
    for (const f of result.findings) {
        baseline[baselineKey(f.file, f)] = true;
    }
    return baseline;
}

export function newFindings(result, baseline) {
    return result.findings.filter((f) => !baseline[baselineKey(f.file, f)]);
}

export function exitCode(result, baseline) {
    return newFindings(result, baseline).length > 0 ? 1 : 0;
}

export function formatReport(result, baseline) {
    const lines = [];
    const fresh = newFindings(result, baseline);
    const knownCount = result.findings.length - fresh.length;

    if (result.findings.length === 0) {
        lines.push(`check-proto-pollution: ${result.scanned} files scanned, no unguarded computed-key writes found.`);
        return lines.join("\n");
    }

    if (fresh.length === 0) {
        lines.push(
            `check-proto-pollution: ${result.scanned} files scanned, ${result.findings.length} known finding(s) ` +
                `(all in tools/proto-pollution-baseline.json). No new ones.`
        );
        return lines.join("\n");
    }

    lines.push(
        `check-proto-pollution: ${fresh.length} NEW computed-key write(s) not in the baseline` +
            (knownCount ? ` (${knownCount} more already baselined)` : ""),
        ""
    );
    for (const f of fresh.slice(0, 40)) {
        lines.push(`    ${f.file}:${f.line}  ${f.text}`);
    }
    if (fresh.length > 40) {
        lines.push(`    ... and ${fresh.length - 40} more`);
    }
    lines.push("");
    lines.push('`obj[key] = value` does not write a data property when key is "__proto__" - it calls');
    lines.push("[[SetPrototypeOf]]. If key can come from external input (wire data, parsed JSON/XML,");
    lines.push("a NodeSet file, a StructureField/browse name), this is a per-instance DoS (class");
    lines.push("instance) or Object.prototype pollution (plain object used as a map).");
    lines.push("");
    lines.push("Fix it the way packages/node-opcua-schemas/source/dynamic_extension_object.ts does:");
    lines.push("write through Object.defineProperty, or reject __proto__/constructor/prototype before");
    lines.push("the key is used, the way convert_data_type_definition_to_structuretype_schema.ts's");
    lines.push("createField() does. If you've reviewed this one and it's genuinely safe (numeric array");
    lines.push("index the checker can't see, Object.create(null) target one level removed, etc.), mark it");
    lines.push(`with a trailing comment "// ${IGNORE_MARKER} - <why>", or run --update to accept it into`);
    lines.push("the baseline as a reviewed, tracked exception.");
    return lines.join("\n");
}
