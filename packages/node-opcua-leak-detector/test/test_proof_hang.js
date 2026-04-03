/**
 * Proof tests for timer leak detection and cleanup.
 *
 * Run ALL:  npx mocha --no-config --timeout 5000 test/test_proof_hang.js
 *   - Proof-3 demonstrates that the leak detector catches and cleans leaked timers
 *   - Without the fix, Proof-3 would hang indefinitely
 */

const assert = require("node:assert");
const { describeWithLeakDetector } = require("../src/resource_leak_detector");

describeWithLeakDetector("Proof-1: no-timers", () => {
    it("exits normally", () => {
        assert.strictEqual(1 + 1, 2);
    });
});

describeWithLeakDetector("Proof-2: ref-timer-cleaned", () => {
    let timer;

    before(() => {
        timer = setTimeout(() => {}, 30 * 60 * 1000);
    });

    after(() => {
        clearTimeout(timer);
    });

    it("exits normally because timer is cleared in after()", () => {
        assert.ok(timer);
    });
});

describeWithLeakDetector("Proof-3: ref-timer-leaked", () => {
    before(() => {
        // This timer is NEVER cleared — simulates a leaked timer.
        // The leak detector catches it in stop() and clears it.
        setTimeout(() => {}, 30 * 60 * 1000);
    });

    it("passes — leak detector prevents hang", () => {
        assert.ok(true);
    });
});

describeWithLeakDetector("Proof-4: unref-timer", () => {
    before(() => {
        const t = setTimeout(() => {}, 30 * 60 * 1000);
        t.unref();
    });

    it("exits normally because timer is unref'd", () => {
        assert.ok(true);
    });
});
