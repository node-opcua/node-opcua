/**
 * Tests for the child-process rule.
 *
 * Half of these pin what it must NOT flag: `.exec(` is mostly RegExp.prototype.exec, and a
 * spawn without a shell is the recommended form.
 */
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyze, exitCode, findViolations, formatReport, IGNORE_MARKER } from "../src/rule.js";

function withTree(files, fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-child-process-"));
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

const lines = (...l) => `${l.join("\n")}\n`;

// ── what it flags ───────────────────────────────────────────────────────────────

test("flags exec from a named import", () => {
    const v = findViolations(lines('import { exec } from "node:child_process";', 'exec("ls");'));
    assert.equal(v.length, 1);
    assert.equal(v[0].line, 2);
    assert.equal(v[0].name, "exec");
    assert.match(v[0].hint, /without a shell/);
});

test("flags an aliased execSync", () => {
    const v = findViolations(lines('import { execSync as run } from "child_process";', "run(cmd);"));
    assert.equal(v.length, 1);
    assert.equal(v[0].name, "execSync");
});

test("flags cp.exec through a namespace import", () => {
    assert.equal(findViolations(lines('import * as cp from "node:child_process";', "cp.exec(cmd);")).length, 1);
});

test("flags cp.execSync through a default import", () => {
    assert.equal(findViolations(lines('import cp from "node:child_process";', "cp.execSync(cmd);")).length, 1);
});

test("flags exec from a require destructuring", () => {
    assert.equal(findViolations(lines('const { exec } = require("child_process");', "exec(cmd);")).length, 1);
});

test("flags spawn with shell: true", () => {
    const v = findViolations(lines('import { spawn } from "node:child_process";', 'spawn("npm", ["x"], { shell: true });'));
    assert.equal(v.length, 1);
});

test("flags a shell computed from the platform", () => {
    const src = lines(
        'import { execFileSync } from "node:child_process";',
        'execFileSync(f, a, { shell: process.platform === "win32" });'
    );
    assert.equal(findViolations(src).length, 1);
});

test("flags a shell taken from a variable", () => {
    const src = lines('import { fork } from "node:child_process";', "fork(f, a, { shell: someVar });");
    assert.equal(findViolations(src).length, 1);
});

// ── what it leaves alone ────────────────────────────────────────────────────────

test("a regular expression exec is not a child process", () => {
    assert.equal(findViolations(lines('import { spawn } from "node:child_process";', "const m = /x/.exec(s);")).length, 0);
});

test("db.exec without a child_process import is not flagged", () => {
    assert.equal(findViolations("db.exec(sql);\n").length, 0);
});

test("db.exec in a file that imports child_process is not flagged", () => {
    assert.equal(findViolations(lines('import cp from "node:child_process";', "db.exec(sql);")).length, 0);
});

test("a function named exec from elsewhere is not flagged", () => {
    assert.equal(findViolations(lines('import { exec } from "./mine.js"; // child_process', "exec(a);")).length, 0);
});

test("shell: false is the recommended form", () => {
    const src = lines('import { execFileSync } from "node:child_process";', "execFileSync(f, a, { shell: false });");
    assert.equal(findViolations(src).length, 0);
});

test("no shell property is fine", () => {
    const src = lines('import { spawn } from "node:child_process";', 'spawn(f, a, { stdio: "inherit" });');
    assert.equal(findViolations(src).length, 0);
});

test("options held in a variable are not flagged", () => {
    const src = lines('import { spawn } from "node:child_process";', "spawn(f, a, options);");
    assert.equal(findViolations(src).length, 0);
});

// ── opting out ──────────────────────────────────────────────────────────────────

test("the marker on the call line exempts it, and it is counted", () => {
    withTree(
        {
            "packages/p/source/a.ts": lines(
                'import { execSync } from "node:child_process";',
                `execSync(c); // ${IGNORE_MARKER} - fixed command`
            )
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

test("the marker on the shell property line exempts a multi-line call", () => {
    const v = findViolations(
        lines('import { spawn } from "node:child_process";', "spawn(f, a, {", `    shell: true // ${IGNORE_MARKER} - why`, "});")
    );
    assert.equal(v.length, 1);
    assert.equal(v[0].ignored, true);
});

test("an unmarked finding fails the run", () => {
    withTree({ "packages/p/source/a.ts": lines('import { exec } from "node:child_process";', "exec(c);") }, (root) => {
        const result = analyze({ repoRoot: root });
        assert.equal(exitCode(result), 1);
        assert.match(formatReport(result), /a\.ts:2/);
    });
});

// ── walking the tree ────────────────────────────────────────────────────────────

test("test trees are not scanned: this is about what ships", () => {
    withTree({ "packages/p/test/a.ts": lines('import { exec } from "node:child_process";', "exec(c);") }, (root) => {
        assert.equal(analyze({ repoRoot: root }).findings.length, 0);
    });
});

test("--package narrows the scan", () => {
    const src = lines('import { exec } from "node:child_process";', "exec(c);");
    withTree({ "packages/p/source/a.ts": src, "packages/q/source/a.ts": src }, (root) => {
        assert.equal(analyze({ repoRoot: root, packageFilter: "p" }).findings.length, 1);
    });
});
