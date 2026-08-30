/**
 * Unit tests for the cycle rule.
 *
 * The classification is the whole value of this tool, so most of these are about telling
 * a dangerous cycle from a benign one. All three shapes below were taken from cycles that
 * actually existed in this repo:
 *
 *   - `class X extends Y` across a cycle          (node-opcua-address-space, 8 files)
 *   - a module-scope map of constructors          (namespace_impl._constructors_map)
 *   - a module-scope loop over an imported table  (opcua_status_code + the generated codes)
 *
 * Run: node test/test_rule.js
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { analyze, exitCode, formatReport, stronglyConnectedComponents, IGNORE_MARKER } from "../src/rule.js";

function withTree(files, fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-cycles-"));
    try {
        for (const [rel, content] of Object.entries(files)) {
            const full = path.join(root, rel);
            fs.mkdirSync(path.dirname(full), { recursive: true });
            fs.writeFileSync(full, content);
        }
        return fn(root);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

const P = "packages/p/source";

// --- the graph algorithm ------------------------------------------------------------

test("finds a simple cycle and ignores an acyclic graph", () => {
    const edges = { a: ["b"], b: ["a"], c: ["d"], d: [] };
    const comps = stronglyConnectedComponents(Object.keys(edges), (v) => edges[v]);
    assert.equal(comps.length, 1);
    assert.deepEqual(comps[0].sort(), ["a", "b"]);
});

test("handles a deep chain without overflowing the stack", () => {
    // the recursive form of Tarjan dies here without --stack-size
    const n = 20000;
    const edges = {};
    for (let i = 0; i < n; i++) edges[`n${i}`] = i + 1 < n ? [`n${i + 1}`] : [];
    const comps = stronglyConnectedComponents(Object.keys(edges), (v) => edges[v]);
    assert.equal(comps.length, 0);
});

test("finds a large cycle in a deep chain", () => {
    const n = 5000;
    const edges = {};
    for (let i = 0; i < n; i++) edges[`n${i}`] = [`n${(i + 1) % n}`];
    const comps = stronglyConnectedComponents(Object.keys(edges), (v) => edges[v]);
    assert.equal(comps.length, 1);
    assert.equal(comps[0].length, n);
});

// --- dangerous: used while the module body runs --------------------------------------

test("flags `class X extends Y` across a cycle", () => {
    withTree(
        {
            [`${P}/a.ts`]: 'import { B } from "./b.js";\nexport class A extends B {}\n',
            [`${P}/b.ts`]: 'import { A } from "./a.js";\nexport class B { make() { return new A(); } }\n'
        },
        (root) => {
            const r = analyze({ repoRoot: root });
            assert.equal(r.cycles.length, 1);
            assert.equal(r.cycles[0].dangerous, true);
            assert.equal(exitCode(r), 1);
            assert.ok(r.cycles[0].uses.some((u) => u.heritage), "the heritage clause must be reported as such");
            assert.match(formatReport(r), /extends\/implements/);
        }
    );
});

test("flags a module-scope initializer, the _constructors_map shape", () => {
    withTree(
        {
            [`${P}/a.ts`]: 'import { B } from "./b.js";\nexport const map = { b: B };\nexport class A {}\n',
            [`${P}/b.ts`]: 'import type { A } from "./a.js";\nimport { helper } from "./a.js";\nexport class B { go(): void { helper(); } }\n',
        },
        (root) => {
            const r = analyze({ repoRoot: root });
            assert.equal(r.cycles.length, 1);
            assert.equal(r.cycles[0].dangerous, true);
        }
    );
});

test("flags a module-scope loop, the generated-status-codes shape", () => {
    withTree(
        {
            [`${P}/a.ts`]: 'export class Base {}\nimport { table } from "./b.js";\nfor (const k of Object.keys(table)) { void k; }\n',
            [`${P}/b.ts`]: 'import { Base } from "./a.js";\nexport const table = { good: new Base() };\n'
        },
        (root) => {
            const r = analyze({ repoRoot: root });
            assert.equal(r.cycles.length, 1);
            assert.equal(r.cycles[0].dangerous, true);
        }
    );
});

// --- benign: only used inside functions ----------------------------------------------

test("does not flag a cycle whose bindings are only used inside functions", () => {
    withTree(
        {
            [`${P}/a.ts`]: 'import { b } from "./b.js";\nexport function a(): number { return b(); }\n',
            [`${P}/b.ts`]: 'import { a } from "./a.js";\nexport function b(): number { return a(); }\n'
        },
        (root) => {
            const r = analyze({ repoRoot: root });
            assert.equal(r.cycles.length, 1, "the cycle is still reported");
            assert.equal(r.cycles[0].dangerous, false, "but it is not dangerous");
            assert.equal(exitCode(r), 0);
            assert.match(formatReport(r), /none that ESM would reject/);
        }
    );
});

test("does not flag a use inside a class method, only a heritage clause", () => {
    withTree(
        {
            [`${P}/a.ts`]: 'import { B } from "./b.js";\nexport class A { make(): B { return new B(); } }\n',
            [`${P}/b.ts`]: 'import { A } from "./a.js";\nexport class B { make(): A { return new A(); } }\n'
        },
        (root) => {
            const r = analyze({ repoRoot: root });
            assert.equal(r.cycles[0].dangerous, false);
        }
    );
});

test("import type creates no edge at all", () => {
    withTree(
        {
            [`${P}/a.ts`]: 'import type { B } from "./b.js";\nexport class A { b?: B; }\n',
            [`${P}/b.ts`]: 'import { A } from "./a.js";\nexport class B extends A {}\n'
        },
        (root) => {
            const r = analyze({ repoRoot: root });
            assert.equal(r.cycles.length, 0, "a type-only import is erased, so there is no cycle");
        }
    );
});

test("a named type-only specifier is erased too", () => {
    withTree(
        {
            [`${P}/a.ts`]: 'import { type B } from "./b.js";\nexport class A { b?: B; }\n',
            [`${P}/b.ts`]: 'import { A } from "./a.js";\nexport class B extends A {}\n'
        },
        (root) => {
            assert.equal(analyze({ repoRoot: root }).cycles.length, 0);
        }
    );
});

test("a side-effect import is a runtime edge, even with no bindings", () => {
    // `import "./x.js"` has no import clause at all, but it forces the target to
    // evaluate, so it very much participates in a cycle
    withTree(
        {
            [`${P}/a.ts`]: 'import "./b.js";\nexport class A {}\n',
            [`${P}/b.ts`]: 'import { A } from "./a.js";\nexport class B extends A {}\n'
        },
        (root) => {
            const r = analyze({ repoRoot: root });
            assert.equal(r.cycles.length, 1, "the side-effect import closes the cycle");
            assert.equal(r.cycles[0].dangerous, true, "and B extends A across it");
        }
    );
});

test("no cycle at all is reported clean", () => {
    withTree(
        {
            [`${P}/a.ts`]: 'import { b } from "./b.js";\nexport const a = b;\n',
            [`${P}/b.ts`]: "export const b = 1;\n"
        },
        (root) => {
            const r = analyze({ repoRoot: root });
            assert.equal(r.cycles.length, 0);
            assert.equal(exitCode(r), 0);
        }
    );
});

// --- escape hatch and plumbing --------------------------------------------------------

test("an ignore marker on any member downgrades the cycle", () => {
    withTree(
        {
            [`${P}/a.ts`]: `// ${IGNORE_MARKER} - deliberate\nimport { B } from "./b.js";\nexport class A extends B {}\n`,
            [`${P}/b.ts`]: 'import { A } from "./a.js";\nexport class B { make() { return new A(); } }\n'
        },
        (root) => {
            const r = analyze({ repoRoot: root });
            assert.equal(r.cycles[0].dangerous, false);
            assert.equal(r.cycles[0].ignored, true);
            assert.equal(exitCode(r), 0);
        }
    );
});

test("export * from participates in the graph", () => {
    withTree(
        {
            [`${P}/a.ts`]: 'export * from "./b.js";\nexport class A {}\n',
            [`${P}/b.ts`]: 'import { A } from "./a.js";\nexport class B extends A {}\n'
        },
        (root) => {
            const r = analyze({ repoRoot: root });
            assert.equal(r.cycles.length, 1);
            assert.equal(r.cycles[0].dangerous, true);
        }
    );
});

test("a directory import resolves to index.ts", () => {
    withTree(
        {
            [`${P}/a.ts`]: 'import { B } from "./sub/index.js";\nexport class A extends B {}\n',
            [`${P}/sub/index.ts`]: 'import { A } from "../a.js";\nexport class B { make() { return new A(); } }\n'
        },
        (root) => {
            assert.equal(analyze({ repoRoot: root }).cycles.length, 1);
        }
    );
});

test("--package narrows the scan", () => {
    withTree(
        {
            "packages/p/source/a.ts": 'import { B } from "./b.js";\nexport class A extends B {}\n',
            "packages/p/source/b.ts": 'import { A } from "./a.js";\nexport class B { m() { return new A(); } }\n',
            "packages/q/source/a.ts": 'import { B } from "./b.js";\nexport class A extends B {}\n',
            "packages/q/source/b.ts": 'import { A } from "./a.js";\nexport class B { m() { return new A(); } }\n'
        },
        (root) => {
            assert.equal(analyze({ repoRoot: root }).cycles.length, 2);
            assert.equal(analyze({ repoRoot: root, packageFilter: "p" }).cycles.length, 1);
        }
    );
});
