/**
 * Unit tests for the short-circuit-assertion rule.
 *
 * The cases that matter are the ones a naive regex gets wrong: an optional chain that is not
 * an assertion at all, several links in one chain, `should(x)` already used as a function
 * (the target form, which must be left alone), an optional chain sitting in the expected
 * value rather than in the subject, and a `?.` inside a template literal, which is generated
 * code rather than code.
 *
 * Run: node test/test_rule.js
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { findViolations, fixText, analyze, exitCode, formatReport, IGNORE_MARKER } from "../src/rule.js";

const FILE = "test.ts";
const IMPORT = 'import should from "should";\n';
const find = (text) => findViolations(text, FILE);
/** fix a body that already imports should, and hand back just the body */
const fix = (body) => fixText(IMPORT + body, FILE).text.slice(IMPORT.length);

function withTree(files, fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-ssc-"));
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

test("an optional chain in front of .should is a violation", () => {
    const v = find("a?.b.should.eql(1);\n");
    assert.equal(v.length, 1);
    assert.equal(v[0].line, 1);
});

test("--fix lifts the subject into should(), keeping the optional chain", () => {
    assert.equal(fix("a?.b.should.eql(1);\n"), "should(a?.b).eql(1);\n");
});

test("the rest of the assertion is left exactly as it was", () => {
    assert.equal(fix("a?.b.should.not.eql(1);\n"), "should(a?.b).not.eql(1);\n");
    assert.equal(fix("a?.b.should.be.true();\n"), "should(a?.b).be.true();\n");
    assert.equal(fix("a?.b.should.have.property('x');\n"), "should(a?.b).have.property('x');\n");
    assert.equal(fix("a?.b.should.match(/x/);\n"), "should(a?.b).match(/x/);\n");
});

test("every link in the chain is kept, not just the first", () => {
    assert.equal(fix("a?.b?.c.should.eql(1);\n"), "should(a?.b?.c).eql(1);\n");
});

test("a `?.` immediately in front of should is the same bug", () => {
    assert.equal(fix("a.b?.should.eql(1);\n"), "should(a.b).eql(1);\n");
});

test("a `!` in the subject is a violation too, and becomes the `?.` it was hiding", () => {
    // `!` does not silence the assertion, it throws a TypeError with no expected value in it
    assert.equal(find("a!.b.should.eql(1);\n").length, 1);
    assert.equal(fix("a!.b.should.eql(1);\n"), "should(a?.b).eql(1);\n");
});

test("a `!` before a call or an index gains the dot it needs", () => {
    assert.equal(fix("a.b!().should.eql(1);\n"), "should(a.b?.()).eql(1);\n");
    assert.equal(fix("a.b![0].should.eql(1);\n"), "should(a.b?.[0]).eql(1);\n");
});

test("a trailing `!` on the subject is simply dropped", () => {
    assert.equal(fix("a.b!.should.eql(1);\n"), "should(a.b).eql(1);\n");
});

test("mixed `!` and `?.` in one chain all end up optional", () => {
    assert.equal(fix("a!.b?.c!.d.should.eql(1);\n"), "should(a?.b?.c?.d).eql(1);\n");
});

test("an optional chain that is not an assertion is left alone", () => {
    const text = "const x = a?.b.c;\nfoo(a?.b);\nconst y = a!.b;\n";
    assert.equal(find(text).length, 0);
    assert.equal(fix(text), text);
});

test("should(x) as a function is already the target form and is never rewritten", () => {
    const text = "should(a?.b).eql(1);\n";
    assert.equal(find(text).length, 0);
    assert.equal(fix(text), text);
});

test("an optional chain inside the expected value is not the assertion's subject", () => {
    const text = "a.b.should.eql(c?.d);\n";
    assert.equal(find(text).length, 0);
    assert.equal(fix(text), text);
});

test("a link inside an argument is not on the chain and is left alone", () => {
    // foo is still called and still returns something, so the assertion runs
    const text = "foo(a?.b).should.eql(1);\n";
    assert.equal(find(text).length, 0);
    assert.equal(fix(text), text);
});

test("a `!` inside an argument is load-bearing and is never removed", () => {
    // it decides the type the argument is checked against; dropping it is a type error
    const text = "verify(sig!, other).should.eql(true);\n";
    assert.equal(find(text).length, 0);
    assert.equal(fix(text), text);
});

test("a `!` inside a computed subject is left alone, parentheses ending the chain", () => {
    const text = "(a.b!.getTime() + 1).should.be.greaterThan(2);\n";
    assert.equal(find(text).length, 0);
    assert.equal(fix(text), text);
});

test("a chain that wraps keeps `?.` as one token when the dot is on the next line", () => {
    // `!` -> `?` alone would leave `?` and `.` split by a newline, which parses as the
    // conditional operator: "error TS1109: Expression expected"
    const text = ["store", "    .getUsers()", "    .find((u) => u.name === 'joe')!", "    .description.should.equal('new');", ""].join("\n");
    const out = fix(text);
    assert.match(out, /\?\.description/);
    assert.doesNotMatch(out, /\?\s*\n\s*\./);
});

test("a plain assertion with no optional link and no `!` is untouched", () => {
    const text = "a.b.should.eql(1);\n";
    assert.equal(find(text).length, 0);
    assert.equal(fix(text), text);
});

test("the ignore marker opts one line out", () => {
    const text = `a?.b.should.eql(1); // ${IGNORE_MARKER} - b is genuinely absent here\n`;
    assert.equal(find(text).length, 0);
    assert.equal(fix(text), text);
});

test("a specifier inside a template literal is not code and is not rewritten", () => {
    // this repo generates TypeScript, and the generator tests assert on the generated text
    const text = "const generated = `a?.b.should.eql(1);`;\n";
    assert.equal(find(text).length, 0);
    assert.equal(fix(text), text);
});

test("a side-effect import of should is promoted to a default import", () => {
    const out = fixText('import "should";\na?.b.should.eql(1);\n', FILE).text;
    assert.equal(out, 'import should from "should";\nshould(a?.b).eql(1);\n');
});

test("a missing import is added after the last import", () => {
    const out = fixText('import fs from "node:fs";\na?.b.should.eql(1);\n', FILE).text;
    assert.equal(out, 'import fs from "node:fs";\nimport should from "should";\nshould(a?.b).eql(1);\n');
});

test("an existing default import is left as it is", () => {
    const out = fixText('import should from "should";\na?.b.should.eql(1);\n', FILE).text;
    assert.equal(out, 'import should from "should";\nshould(a?.b).eql(1);\n');
});

test("a file that binds `should` to something else is reported, not rewritten", () => {
    const text = 'const should = makeThing();\na?.b.should.eql(1);\n';
    const result = fixText(text, FILE);
    assert.equal(result.text, text, "must not call the local `should`");
    assert.equal(result.fixed, 0);
    assert.equal(result.skipped, 1);
});

test("a namespace import of should is reported, not rewritten", () => {
    // `import * as should` is an object, not a callable
    const text = 'import * as should from "should";\na?.b.should.eql(1);\n';
    const result = fixText(text, FILE);
    assert.equal(result.text, text);
    assert.equal(result.skipped, 1);
});

test("the fix is idempotent", () => {
    const once = fix("a?.b.should.eql(1);\n");
    assert.equal(fix(once), once);
});

test("analyze walks the package trees and exitCode reflects the findings", () => {
    withTree({ "packages/p/test/a.ts": "x?.y.should.eql(1);\n", "packages/p/source/b.ts": "const z = q?.r;\n" }, (root) => {
        const result = analyze({ repoRoot: root });
        assert.equal(result.findings.length, 1);
        assert.equal(exitCode(result), 1);
        assert.match(formatReport(result), /1 assertion\(s\) an optional chain can switch off/);
    });
});

test("--fix writes the files and the gate then reports clean", () => {
    withTree({ "packages/p/test/a.ts": 'import "should";\nx?.y.should.eql(1);\n' }, (root) => {
        const result = analyze({ repoRoot: root, write: true });
        assert.equal(result.fixedCount, 1);
        assert.equal(result.findings.length, 0);
        assert.equal(exitCode(result), 0);
        assert.equal(
            fs.readFileSync(path.join(root, "packages/p/test/a.ts"), "utf8"),
            'import should from "should";\nshould(x?.y).eql(1);\n'
        );
    });
});

test("dist trees are never scanned", () => {
    withTree({ "packages/p/dist/a.js": "x?.y.should.eql(1);\n", "packages/p/dist/a.ts": "x?.y.should.eql(1);\n" }, (root) => {
        assert.equal(analyze({ repoRoot: root }).findings.length, 0);
    });
});
