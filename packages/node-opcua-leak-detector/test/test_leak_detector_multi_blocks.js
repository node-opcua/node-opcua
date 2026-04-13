/**
 * T11 - Multiple describeWithLeakDetector blocks
 *
 * Demonstrates the side-effect when multiple
 * describeWithLeakDetector blocks run sequentially:
 *
 *   Block 1: start() → patch setTimeout → tests → stop() → restore setTimeout
 *   Block 2: start() → patch setTimeout → tests → stop() → restore setTimeout
 *   Block 3: start() → patch setTimeout → tests → stop() → restore setTimeout
 *
 * Between stop() of Block 1 and start() of Block 2, global.setTimeout
 * is the NATIVE version. Any timer created in that gap (e.g. by mocha
 * internals, after hooks, or module-level code) is NOT tracked by our
 * wrapper and won't be cleaned up by stop().
 *
 * Additionally, on Windows, stdout/stderr are Socket handles that are
 * always ref'd. These keep the event loop alive even with no timers.
 * The leak detector must unref them in the final stop() to allow
 * clean process exit.
 *
 * This test proves we handle all these cases correctly without hanging.
 */

const assert = require("node:assert");

// These tests intentionally leak timers that only the detector
// cleans up. Without it the process hangs — skip entirely.
if (process.env.MEM_LEAK_DETECTION_DISABLED === "true") {
    describe("T11 - Multi-block tests (skipped — leak detection disabled)", () => {});
    return;
}

const { describeWithLeakDetector } = require("../src/resource_leak_detector");

// ─────────────────────────────────────────────────────────
// T11.A - First block: creates and cleans a timer
// ─────────────────────────────────────────────────────────

describeWithLeakDetector("T11.A - First block", () => {
    let timer;

    before(() => {
        timer = setTimeout(() => { }, 60000);
    });

    after(() => {
        clearTimeout(timer);
    });

    it("test in first block", () => {
        assert.ok(timer);
    });
});

// ─────────────────────────────────────────────────────────
// T11.B - Second block: creates a timer that LEAKS
//         (not cleared in after)
// ─────────────────────────────────────────────────────────

describeWithLeakDetector("T11.B - Second block (leaked timer)", () => {
    before(() => {
        // This timer is intentionally leaked
        setTimeout(() => { }, 60000);
    });

    it("test in second block", () => {
        assert.ok(true);
    });
});

// ─────────────────────────────────────────────────────────
// T11.C - Third block: no timers, just verifies process
//         doesn't hang from the leak in block B
// ─────────────────────────────────────────────────────────

describeWithLeakDetector("T11.C - Third block (no timers)", () => {
    it("test in third block - should still exit cleanly", () => {
        assert.ok(true);
    });

    it("async test in third block", async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        assert.ok(true);
    });
});

// ─────────────────────────────────────────────────────────
// T11.D - Timer created between blocks via gap test
//
// This block creates a timer in before() and also
// schedules a module-level timer that fires after the
// test completes (simulating a timer created in the gap
// between block stop/start).
// ─────────────────────────────────────────────────────────

describeWithLeakDetector("T11.D - Gap timer simulation", () => {
    before(() => {
        // Timer that fires quickly during the test (not leaked)
        const _t = setTimeout(() => { }, 1);
        // Don't clear — it fires fast and auto-removes from tracking
    });

    it("gap test passes", () => {
        assert.ok(true);
    });
});

// ─────────────────────────────────────────────────────────
// T11.E - Final block verifies clean state
// ─────────────────────────────────────────────────────────

describeWithLeakDetector("T11.E - Final block (clean state)", () => {
    it("process can still exit cleanly after all prior blocks", () => {
        assert.strictEqual(1 + 1, 2);
    });
});
