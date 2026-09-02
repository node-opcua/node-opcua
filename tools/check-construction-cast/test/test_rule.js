/**
 * Tests for the construction-cast rule.
 *
 * The rule is narrow on purpose: only an `as` whose target is a constructor type counts.
 * Most of these tests pin the things it must NOT flag, because a gate that fires on
 * ordinary narrowing gets switched off.
 */
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyze, exitCode, findViolations, formatReport, IGNORE_MARKER } from "../src/rule.js";

/** build a throwaway tree from a { relativePath: contents } map */
function withTree(files, fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ctor-cast-"));
    try {
        for (const [rel, contents] of Object.entries(files)) {
            const full = path.join(root, rel);
            fs.mkdirSync(path.dirname(full), { recursive: true });
            fs.writeFileSync(full, contents);
        }
        fn(root);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

// ── what it flags ───────────────────────────────────────────────────────────────

test("flags a class published through a constructor cast", () => {
    const v = findViolations("export const X = XImplBase as unknown as new () => X;\n");
    assert.equal(v.length, 1);
    assert.equal(v[0].line, 1);
});

test("flags the generic form", () => {
    const src = "export const X = XImplBase as unknown as new <T, DT extends DataType>() => X<T, DT>;\n";
    assert.equal(findViolations(src).length, 1);
});

test("flags a single `as`, not only the `as unknown as` pair", () => {
    assert.equal(findViolations("const X = Y as new () => Z;\n").length, 1);
});

test("flags a constructor cast that takes arguments", () => {
    assert.equal(findViolations("const X = Y as unknown as new (options: unknown) => Z;\n").length, 1);
});

test("reports each cast when a file has several", () => {
    const src = ["const A = B as unknown as new () => C;", "const D = E as unknown as new () => F;", ""].join("\n");
    assert.deepEqual(
        findViolations(src).map((v) => v.line),
        [1, 2]
    );
});

test("finds one that spans several lines, and reports where it starts", () => {
    const src = ["export const X = XImplBase as unknown as new <", "    T,", "    DT", ">() => X<T, DT>;", ""].join("\n");
    const v = findViolations(src);
    assert.equal(v.length, 1);
    assert.equal(v[0].line, 1);
});

// ── what it leaves alone ────────────────────────────────────────────────────────

test("ignores an ordinary narrowing", () => {
    assert.equal(findViolations("const c = node as UAConditionEx;\n").length, 0);
});

test("ignores `as unknown as` to a non-constructor type", () => {
    assert.equal(findViolations("const c = node as unknown as UAConditionEx;\n").length, 0);
});

test("ignores a plain `new` expression", () => {
    assert.equal(findViolations("const x = new Foo();\nconst y = new Foo() as Bar;\n").length, 0);
});

test("ignores a declared constructor type that is not a cast", () => {
    assert.equal(findViolations("export declare const X: new () => Y;\n").length, 0);
});

test("ignores `new () =>` inside a string", () => {
    assert.equal(findViolations('const s = "as unknown as new () => X";\n').length, 0);
});

test("ignores `new () =>` inside a comment", () => {
    assert.equal(findViolations("// const X = Y as unknown as new () => Z;\nconst a = 1;\n").length, 0);
});

test("ignores a constructor type in a normal type position", () => {
    assert.equal(findViolations("function f(ctor: new () => Foo): void {}\n").length, 0);
});

// ── opting out ──────────────────────────────────────────────────────────────────

test("the marker exempts a cast, and it is counted rather than hidden", () => {
    withTree(
        {
            "packages/p/source/a.ts": `// ${IGNORE_MARKER} - serves two interfaces that disagree\nexport const X = Y as unknown as new () => Z;\n`
        },
        (root) => {
            const result = analyze({ repoRoot: root });
            assert.equal(result.findings.length, 0);
            assert.equal(result.exempt, 1);
            assert.equal(exitCode(result), 0);
            assert.match(formatReport(result), /1 exempted/);
        }
    );
});

test("the marker works on the cast's own line", () => {
    const src = `export const X = Y as unknown as new () => Z; // ${IGNORE_MARKER} - why\n`;
    assert.equal(findViolations(src)[0].ignored, true);
});

test("the marker works on any line a multi-line cast spans", () => {
    const src = [
        "export const X = XImplBase as unknown as new <",
        `    T // ${IGNORE_MARKER} - why`,
        ">() => X<T>;",
        ""
    ].join("\n");
    assert.equal(findViolations(src)[0].ignored, true);
});

test("a marker elsewhere in the file does not exempt", () => {
    const src = [`// ${IGNORE_MARKER} - unrelated`, "const a = 1;", "", "", "const X = Y as unknown as new () => Z;", ""].join(
        "\n"
    );
    assert.equal(findViolations(src)[0].ignored, false);
});

// ── walking the tree ────────────────────────────────────────────────────────────

test("scans what each package publishes, not a hardcoded source/src", () => {
    withTree(
        {
            "packages/p/package.json": JSON.stringify({ name: "p", files: ["api", "impl"] }),
            "packages/p/api/a.ts": "const X = Y as unknown as new () => Z;\n",
            "packages/p/impl/b.ts": "const X = Y as unknown as new () => Z;\n"
        },
        (root) => {
            const result = analyze({ repoRoot: root });
            assert.equal(result.scanned, 2);
            assert.equal(result.findings.length, 2);
            assert.equal(exitCode(result), 1);
        }
    );
});

test("test trees are not scanned: this is about what ships", () => {
    withTree({ "packages/p/test/a.ts": "const X = Y as unknown as new () => Z;\n" }, (root) => {
        assert.equal(analyze({ repoRoot: root }).findings.length, 0);
    });
});

test("declaration files are not scanned", () => {
    withTree({ "packages/p/source/a.d.ts": "const X = Y as unknown as new () => Z;\n" }, (root) => {
        assert.equal(analyze({ repoRoot: root }).scanned, 0);
    });
});

test("--package narrows the scan", () => {
    withTree(
        {
            "packages/p/source/a.ts": "const X = Y as unknown as new () => Z;\n",
            "packages/q/source/a.ts": "const X = Y as unknown as new () => Z;\n"
        },
        (root) => {
            assert.equal(analyze({ repoRoot: root, packageFilter: "p" }).findings.length, 1);
        }
    );
});

test("the report names the count it scanned, so a narrow scope is visible", () => {
    withTree({ "packages/p/source/a.ts": "const a = 1;\n" }, (root) => {
        assert.match(formatReport(analyze({ repoRoot: root })), /1 files scanned/);
    });
});

test("a clean tree exits 0", () => {
    withTree({ "packages/p/source/a.ts": "export class A {}\n" }, (root) => {
        const result = analyze({ repoRoot: root });
        assert.equal(exitCode(result), 0);
        assert.match(formatReport(result), /no class is published through a constructor cast/);
    });
});
