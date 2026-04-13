/**
 * T1 - Timer lifecycle: leaked, cleaned, unref'd
 * T2 - Test style variations: done, async, sync
 */

const assert = require("node:assert");
const { describeWithLeakDetector } = require("../src/resource_leak_detector");

// ─────────────────────────────────────────────────────────
// T1. Timer lifecycle
// ─────────────────────────────────────────────────────────

describeWithLeakDetector("T1 - Timer lifecycle", () => {

    describe("T1.1 - No timers", () => {
        it("should exit normally (sync)", () => {
            assert.strictEqual(1 + 1, 2);
        });
    });

    describe("T1.2 - Cleaned timer", () => {
        let timer;

        before(() => {
            timer = setTimeout(() => { }, 30 * 60 * 1000);
        });

        after(() => {
            clearTimeout(timer);
        });

        it("should exit because timer is cleared in after()", () => {
            assert.ok(timer);
        });
    });

    describe("T1.3 - Leaked ref'd timer (caught by leak detector)", () => {
        before(() => {
            // This timer is NEVER cleared — simulates a leaked timer.
            // The leak detector will catch it in stop() and clear it.
            setTimeout(() => { }, 30 * 60 * 1000);
        });

        it("should pass and leak detector cleans the timer", () => {
            assert.ok(true);
        });
    });

    describe("T1.4 - Unref'd timer", () => {
        before(() => {
            const t = setTimeout(() => { }, 30 * 60 * 1000);
            t.unref();
        });

        it("should exit because timer is unref'd", () => {
            assert.ok(true);
        });
    });
});

// ─────────────────────────────────────────────────────────
// T2. Test style variations
// ─────────────────────────────────────────────────────────

describeWithLeakDetector("T2 - Test style variations", () => {

    describe("T2.1 - Sync tests", () => {
        it("sync pass", () => {
            assert.strictEqual(42, 42);
        });

        it("sync with timer started and cleared", () => {
            const t = setTimeout(() => { }, 100);
            clearTimeout(t);
        });
    });

    describe("T2.2 - done() callback tests", () => {
        it("done callback - immediate", (done) => {
            done();
        });

        it("done callback - with timer", (done) => {
            setTimeout(() => {
                assert.ok(true);
                done();
            }, 10);
        });

        it("done callback - with error check", (done) => {
            setTimeout(() => {
                try {
                    assert.strictEqual(1, 1);
                    done();
                } catch (err) {
                    done(err);
                }
            }, 10);
        });
    });

    describe("T2.3 - async/await tests", () => {
        it("async - returning promise", async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            assert.ok(true);
        });

        it("async - multiple awaits", async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            await new Promise((resolve) => setTimeout(resolve, 5));
            assert.strictEqual(2 + 2, 4);
        });

        it("async - no await (returns implicit undefined)", async () => {
            assert.ok(true);
        });
    });

    describe("T2.4 - async without explicit return", () => {
        it("async function body with no return", async () => {
            const x = 42;
            assert.strictEqual(x, 42);
        });
    });
});
