/**
 * Proof tests for timer leak detection and cleanup.
 *
 * Run ALL:  npx mocha --no-config --timeout 5000 test/test_proof_hang.js
 *   - Proof-3 demonstrates that the leak detector catches and cleans leaked timers
 *   - Without the fix, Proof-3 would hang indefinitely
 */

import assert from "node:assert";
import { describeWithLeakDetector } from "../index.js";

// These tests intentionally leak timers that only the detector cleans up. Without it the
// process hangs, so nothing below is registered.
//
// This used to be a module-level `return`, which CommonJS allows and ES modules do not.
const leakDetectionDisabled = process.env.MEM_LEAK_DETECTION_DISABLED === "true";

if (leakDetectionDisabled) {
    describe("Proof tests (skipped — leak detection disabled)", () => {});
}

const describeBlock = leakDetectionDisabled
    ? (_name: string, _fn: () => void) => {
          /* leak detection disabled: the block is not registered */
      }
    : describeWithLeakDetector;

describeBlock("Proof-1: no-timers", () => {
    it("exits normally", () => {
        assert.strictEqual(1 + 1, 2);
    });
});

describeBlock("Proof-2: ref-timer-cleaned", () => {
    let timer: NodeJS.Timeout | undefined;

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

describeBlock("Proof-3: ref-timer-leaked", () => {
    before(() => {
        // This timer is NEVER cleared — simulates a leaked timer.
        // The leak detector catches it in stop() and clears it.
        setTimeout(() => {}, 30 * 60 * 1000);
    });

    it("passes — leak detector prevents hang", () => {
        assert.ok(true);
    });
});

describeBlock("Proof-4: unref-timer", () => {
    before(() => {
        const t = setTimeout(() => {}, 30 * 60 * 1000);
        t.unref();
    });

    it("exits normally because timer is unref'd", () => {
        assert.ok(true);
    });
});
