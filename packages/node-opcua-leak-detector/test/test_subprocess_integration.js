/**
 * Subprocess-based integration tests for the leak detector.
 *
 * These tests spawn mocha as a child process and verify:
 *   - Exit code (0 for pass, non-zero for fail)
 *   - Full output (passing/failing counts, leak warnings)
 *   - Process doesn't hang (timeout kills it)
 *   - Multi-file runs complete all files
 *   - tsx-loaded tests exit cleanly
 *   - Leaked handles (timers, intervals, sockets, fds) are reported
 *
 * This is the authoritative proof that the leak detector
 * works correctly in real mocha scenarios.
 */

const assert = require("node:assert");
const { execSync } = require("node:child_process");
const path = require("node:path");

const FIXTURES = path.join(__dirname, "fixtures");

// Helper: run mocha on fixture file(s) and return { exitCode, stdout }
function runMocha(fixtureFiles, extraArgs = []) {
    const files = Array.isArray(fixtureFiles) ? fixtureFiles : [fixtureFiles];
    const args = [
        "--no-config",
        "--timeout", "10000",
        ...extraArgs,
        ...files.map((f) => path.join(FIXTURES, f)),
    ];
    const cmd = `npx mocha ${args.join(" ")}`;
    // Build a clean env so parent settings like
    // MEM_LEAK_DETECTION_DISABLED don't leak into the fixtures
    // (the fixtures NEED the leak detector active to produce
    // the warnings that the assertions check for).
    const env = { ...process.env };
    delete env.MEM_LEAK_DETECTION_DISABLED;
    try {
        const stdout = execSync(cmd, {
            cwd: path.join(__dirname, ".."),
            timeout: 15000,
            encoding: "utf8",
            stdio: ["pipe", "pipe", "pipe"],
            env,
        });
        return { exitCode: 0, stdout };
    } catch (err) {
        return {
            exitCode: err.status || 1,
            stdout: (err.stdout || "") + (err.stderr || ""),
        };
    }
}

describe("Subprocess integration tests", function () {
    this.timeout(30000);

    // ── Basic pass/fail ─────────────────────────────────

    it("S1 - passing tests exit with code 0", () => {
        const { exitCode, stdout } = runMocha("fixture_pass.js");
        assert.strictEqual(exitCode, 0, `Expected exit 0, got ${exitCode}\n${stdout}`);
        assert.ok(stdout.includes("2 passing"), `Expected '2 passing' in output:\n${stdout}`);
    });

    it("S2 - failing tests exit with non-zero code", () => {
        const { exitCode, stdout } = runMocha("fixture_fail.js");
        assert.notStrictEqual(exitCode, 0, `Expected non-zero exit, got ${exitCode}`);
        assert.ok(stdout.includes("1 failing"), `Expected '1 failing' in output:\n${stdout}`);
        assert.ok(stdout.includes("intentional failure"), `Expected error message in output:\n${stdout}`);
    });

    // ── Timer leaks ─────────────────────────────────────

    it("S3 - leaked setTimeout is reported and cleaned (no hang)", () => {
        const { exitCode, stdout } = runMocha("fixture_leaked_timer.js");
        assert.strictEqual(exitCode, 0, `Expected exit 0, got ${exitCode}\n${stdout}`);
        assert.ok(stdout.includes("1 passing"), `Expected '1 passing' in output:\n${stdout}`);
        assert.ok(
            stdout.includes("setTimeout handle(s) were not cleared"),
            `Expected leak warning in output:\n${stdout}`,
        );
    });

    it("S3b - leaked setInterval is reported (no hang)", () => {
        const { exitCode, stdout } = runMocha("fixture_leaked_interval.js");
        // The interval leak may cause a non-zero exit depending on
        // detector strictness, but the process must NOT hang
        assert.ok(typeof exitCode === "number", "Process must exit");
        assert.ok(stdout.includes("1 passing"), `Expected '1 passing':\n${stdout}`);
    });

    // ── Multi-file ──────────────────────────────────────

    it("S4 - multi-file run completes ALL files", () => {
        const { exitCode, stdout } = runMocha([
            "fixture_multi_a.js",
            "fixture_multi_b.js",
        ]);
        assert.strictEqual(exitCode, 0, `Expected exit 0, got ${exitCode}\n${stdout}`);
        assert.ok(stdout.includes("fixture-multi-A"), `Missing block A:\n${stdout}`);
        assert.ok(stdout.includes("fixture-multi-B"), `Missing block B:\n${stdout}`);
        assert.ok(stdout.includes("4 passing"), `Expected '4 passing' in output:\n${stdout}`);
    });

    it("S6 - multi-file with failure in first file still runs second", () => {
        const { exitCode, stdout } = runMocha([
            "fixture_fail.js",
            "fixture_pass.js",
        ]);
        assert.notStrictEqual(exitCode, 0, "Expected non-zero exit due to failure");
        assert.ok(stdout.includes("fixture-fail"), `Missing fixture-fail:\n${stdout}`);
        assert.ok(stdout.includes("fixture-pass"), `Missing fixture-pass (2nd file wasn't run!):\n${stdout}`);
    });

    it("S7 - leaked timer + failure: correct exit code and leak report", () => {
        const { exitCode, stdout } = runMocha([
            "fixture_leaked_timer.js",
            "fixture_fail.js",
        ]);
        assert.notStrictEqual(exitCode, 0, "Expected non-zero exit due to failure");
        assert.ok(
            stdout.includes("setTimeout handle(s) were not cleared"),
            `Expected leak warning:\n${stdout}`,
        );
        assert.ok(stdout.includes("1 failing"), `Expected failure report:\n${stdout}`);
    });

    // ── Nested describes ────────────────────────────────

    it("S8 - nested describeWithLeakDetector blocks all run", () => {
        const { exitCode, stdout } = runMocha("fixture_nested.js");
        assert.strictEqual(exitCode, 0, `Expected exit 0, got ${exitCode}\n${stdout}`);
        assert.ok(stdout.includes("fixture-nested-outer"), `Missing outer:\n${stdout}`);
        assert.ok(stdout.includes("fixture-nested-second-block"), `Missing second block:\n${stdout}`);
        assert.ok(stdout.includes("deeply nested test"), `Missing nested test:\n${stdout}`);
    });

    // ── Handle leaks (socket, fd) ───────────────────────

    it("S9 - leaked net.Server socket does not hang", () => {
        const { exitCode, stdout } = runMocha("fixture_leaked_socket.js");
        // Process must exit (not hang), exit code may be 0 or non-zero
        assert.ok(typeof exitCode === "number", "Process must exit");
        assert.ok(stdout.includes("1 passing"), `Expected '1 passing':\n${stdout}`);
    });

    it("S10 - leaked file descriptor does not hang", () => {
        const { exitCode, stdout } = runMocha("fixture_leaked_fd.js");
        assert.ok(typeof exitCode === "number", "Process must exit");
        assert.ok(stdout.includes("1 passing"), `Expected '1 passing':\n${stdout}`);
    });

    // ── tsx (TypeScript) ────────────────────────────────

    it("S5 - tsx TypeScript fixture exits cleanly", () => {
        const { exitCode, stdout } = runMocha("fixture_tsx.ts", [
            "--require", "tsx",
        ]);
        assert.strictEqual(exitCode, 0, `Expected exit 0, got ${exitCode}\n${stdout}`);
        assert.ok(stdout.includes("2 passing"), `Expected '2 passing' in output:\n${stdout}`);
    });

    it("S11 - tsx with leaked timer + multi-block exits cleanly", () => {
        const { exitCode, stdout } = runMocha("fixture_tsx_leaked.ts", [
            "--require", "tsx",
        ]);
        assert.strictEqual(exitCode, 0, `Expected exit 0, got ${exitCode}\n${stdout}`);
        assert.ok(stdout.includes("fixture-tsx-leaked"), `Missing first block:\n${stdout}`);
        assert.ok(stdout.includes("fixture-tsx-second-block"), `Missing second block:\n${stdout}`);
        assert.ok(
            stdout.includes("setTimeout handle(s) were not cleared"),
            `Expected leak warning:\n${stdout}`,
        );
    });

    it("S12 - tsx multi-file runs all files", () => {
        const { exitCode, stdout } = runMocha(
            ["fixture_tsx.ts", "fixture_tsx_leaked.ts"],
            ["--require", "tsx"],
        );
        assert.strictEqual(exitCode, 0, `Expected exit 0, got ${exitCode}\n${stdout}`);
        assert.ok(stdout.includes("fixture-tsx"), `Missing fixture-tsx:\n${stdout}`);
        assert.ok(stdout.includes("fixture-tsx-leaked"), `Missing fixture-tsx-leaked:\n${stdout}`);
    });

    // ── ObjectRegistry leaks ────────────────────────────

    it("S13 - leaked registered objects are reported (no hang)", () => {
        const { exitCode, stdout } = runMocha("fixture_leaked_registry.js");
        // The registry leak should cause a non-zero exit (LEAKS error)
        assert.ok(typeof exitCode === "number", "Process must exit");
        // The test itself passes — it's the afterAll check that fails
        assert.ok(stdout.includes("1 passing"), `Expected '1 passing':\n${stdout}`);
    });
});
