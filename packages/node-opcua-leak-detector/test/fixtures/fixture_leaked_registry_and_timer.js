// Fixture: a registry leak (which makes stop() throw) combined with a leaked
// ref'd timer. Reproduces the hang where stop() reported the leak before
// clearing the tracked timers, leaving the mocha worker's event loop alive
// for the full duration of the leaked timer.
import assert from "node:assert";
import { ObjectRegistry } from "node-opcua-object-registry";
import { describeWithLeakDetector } from "../../src/resource_leak_detector.js";

const registry = new ObjectRegistry();
const leaked = [];

describeWithLeakDetector("fixture-leaked-registry-and-timer", () => {
    it("leaks a registered object and a long ref'd timer", () => {
        // Held in a module-scope array on purpose. ObjectRegistry stores a WeakRef, so
        // an object nobody references is not a leak - it is garbage, and count() is
        // right to drop it. Node 22 happened to keep it alive to the end of the run and
        // the fixture read as a leak; Node 26's V8 collects it in the very next turn,
        // so the registry was empty by the time stop() looked and no leak was reported.
        // A real leak is an object something still holds, which is what this now is.
        leaked.push({ toString: () => "FakeResource-1" });
        registry.register(leaked[leaked.length - 1]);
        // 60s, ref'd, never cleared: longer than the harness timeout, so a
        // regression shows up as a timeout kill rather than a slow pass.
        setTimeout(() => { }, 60 * 1000);
        assert.strictEqual(registry.count(), 1);
    });
});
