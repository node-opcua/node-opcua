// Fixture: a registry leak (which makes stop() throw) combined with a leaked
// ref'd timer. Reproduces the hang where stop() reported the leak before
// clearing the tracked timers, leaving the mocha worker's event loop alive
// for the full duration of the leaked timer.
const assert = require("node:assert");
const { ObjectRegistry } = require("node-opcua-object-registry");
const { describeWithLeakDetector } = require("../../src/resource_leak_detector");

const registry = new ObjectRegistry();

describeWithLeakDetector("fixture-leaked-registry-and-timer", () => {
    it("leaks a registered object and a long ref'd timer", () => {
        registry.register({ toString: () => "FakeResource-1" });
        // 60s, ref'd, never cleared: longer than the harness timeout, so a
        // regression shows up as a timeout kill rather than a slow pass.
        setTimeout(() => { }, 60 * 1000);
        assert.strictEqual(registry.count(), 1);
    });
});
