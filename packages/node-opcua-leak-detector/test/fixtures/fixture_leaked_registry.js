// Fixture: leaked registered objects via ObjectRegistry
import assert from "node:assert";
import { ObjectRegistry } from "node-opcua-object-registry";
import { describeWithLeakDetector } from "../../src/resource_leak_detector.js";

const registry = new ObjectRegistry();
// The registry holds WeakRefs, so an object nobody else references is garbage rather
// than a leak: Node 26's V8 collects it in the next turn and the registry is empty by
// the time the detector looks. Keep the leaked ones reachable, as a real leak would be.
const leaked = [];

class FakeResource {
    constructor(id) {
        this.id = id;
        registry.register(this);
    }
    dispose() {
        registry.unregister(this);
    }
    toString() {
        return `FakeResource-${this.id}`;
    }
}

describeWithLeakDetector("fixture-leaked-registry", () => {
    it("creates registered objects without disposing them", () => {
        // Intentionally NOT disposing — registry leak
        const r1 = new FakeResource(1);
        const r2 = new FakeResource(2); // intentionally leaked
        const r3 = new FakeResource(3); // intentionally leaked
        leaked.push(r2, r3);
        assert.strictEqual(registry.count(), 3);
        // Only dispose one — 2 remain leaked
        r1.dispose();
        assert.strictEqual(registry.count(), 2);
    });
});
