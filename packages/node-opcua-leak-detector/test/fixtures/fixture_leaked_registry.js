// Fixture: leaked registered objects via ObjectRegistry
const assert = require("node:assert");
const { ObjectRegistry } = require("node-opcua-object-registry");
const { describeWithLeakDetector } = require("../../src/resource_leak_detector");

const registry = new ObjectRegistry();

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
        void r2; void r3;
        assert.strictEqual(registry.count(), 3);
        // Only dispose one — 2 remain leaked
        r1.dispose();
        assert.strictEqual(registry.count(), 2);
    });
});
