/**
 * T8 - ObjectRegistry leak detection
 *
 * Demonstrates that the leak detector correctly reports
 * leaked ObjectRegistry entries and does NOT hang.
 */

const assert = require("node:assert");
const { ObjectRegistry } = require("node-opcua-object-registry");
const { describeWithLeakDetector } = require("../src/resource_leak_detector");

// ─────────────────────────────────────────────────────────
// T8. ObjectRegistry — properly registered and unregistered
// ─────────────────────────────────────────────────────────

class FakeResource {
    constructor(name) {
        this.name = name;
        FakeResource.registry.register(this);
    }

    dispose() {
        FakeResource.registry.unregister(this);
    }

    toString() {
        return `FakeResource(${this.name})`;
    }
}
FakeResource.registry = new ObjectRegistry();

class AnotherResource {
    constructor(id) {
        this.id = id;
        AnotherResource.registry.register(this);
    }

    dispose() {
        AnotherResource.registry.unregister(this);
    }

    toString() {
        return `AnotherResource(${this.id})`;
    }
}
AnotherResource.registry = new ObjectRegistry();

describeWithLeakDetector("T8 - ObjectRegistry: proper lifecycle", () => {
    let res1;
    let res2;
    let res3;

    before(() => {
        res1 = new FakeResource("alpha");
        res2 = new FakeResource("beta");
        res3 = new AnotherResource(42);
    });

    after(() => {
        res1.dispose();
        res2.dispose();
        res3.dispose();
    });

    it("T8.1 - registry counts match registrations", () => {
        assert.strictEqual(FakeResource.registry.count(), 2);
        assert.strictEqual(AnotherResource.registry.count(), 1);
    });

    it("T8.2 - registry class name is inferred", () => {
        assert.strictEqual(
            FakeResource.registry.getClassName(),
            "FakeResource"
        );
        assert.strictEqual(
            AnotherResource.registry.getClassName(),
            "AnotherResource"
        );
    });

    it("T8.3 - unregister decrements count", () => {
        const tmp = new FakeResource("gamma");
        assert.strictEqual(FakeResource.registry.count(), 3);
        tmp.dispose();
        assert.strictEqual(FakeResource.registry.count(), 2);
    });
});

// ─────────────────────────────────────────────────────────
// T9. ObjectRegistry — multiple register/unregister cycles
// ─────────────────────────────────────────────────────────

class CycledResource {
    constructor(n) {
        this.n = n;
        CycledResource.registry.register(this);
    }

    dispose() {
        CycledResource.registry.unregister(this);
    }

    toString() {
        return `CycledResource(${this.n})`;
    }
}
CycledResource.registry = new ObjectRegistry();

describeWithLeakDetector("T9 - ObjectRegistry: create/dispose cycles", () => {

    it("T9.1 - create and dispose in sequence", () => {
        for (let i = 0; i < 10; i++) {
            const r = new CycledResource(i);
            assert.strictEqual(CycledResource.registry.count(), 1);
            r.dispose();
            assert.strictEqual(CycledResource.registry.count(), 0);
        }
    });

    it("T9.2 - batch create then batch dispose", () => {
        const batch = [];
        for (let i = 0; i < 5; i++) {
            batch.push(new CycledResource(i));
        }
        assert.strictEqual(CycledResource.registry.count(), 5);
        for (const r of batch) {
            r.dispose();
        }
        assert.strictEqual(CycledResource.registry.count(), 0);
    });

    it("T9.3 - interleaved create/dispose", () => {
        const a = new CycledResource("a");
        const b = new CycledResource("b");
        assert.strictEqual(CycledResource.registry.count(), 2);
        a.dispose();
        assert.strictEqual(CycledResource.registry.count(), 1);
        const c = new CycledResource("c");
        assert.strictEqual(CycledResource.registry.count(), 2);
        b.dispose();
        c.dispose();
        assert.strictEqual(CycledResource.registry.count(), 0);
    });
});

// ─────────────────────────────────────────────────────────
// T10. ObjectRegistry with timers — combined scenario
//      Registers objects, creates timers, disposes all
//      properly, and demonstrates no hang.
// ─────────────────────────────────────────────────────────

class TimedResource {
    constructor(name) {
        this.name = name;
        this.timer = setTimeout(() => {
            this._onTimer();
        }, 60000);
        TimedResource.registry.register(this);
    }

    _onTimer() {
        // simulated periodic work
    }

    dispose() {
        clearTimeout(this.timer);
        this.timer = null;
        TimedResource.registry.unregister(this);
    }

    toString() {
        return `TimedResource(${this.name})`;
    }
}
TimedResource.registry = new ObjectRegistry();

describeWithLeakDetector("T10 - ObjectRegistry with timers", () => {
    const resources = [];

    before(() => {
        for (let i = 0; i < 3; i++) {
            resources.push(new TimedResource(`res-${i}`));
        }
    });

    after(() => {
        for (const r of resources) {
            r.dispose();
        }
    });

    it("T10.1 - all resources registered", () => {
        assert.strictEqual(TimedResource.registry.count(), 3);
    });

    it("T10.2 - each resource has an active timer", () => {
        for (const r of resources) {
            assert.ok(r.timer);
        }
    });

    it("T10.3 - dispose clears timer and unregisters", () => {
        const extra = new TimedResource("extra");
        assert.strictEqual(TimedResource.registry.count(), 4);
        assert.ok(extra.timer);

        extra.dispose();
        assert.strictEqual(TimedResource.registry.count(), 3);
        assert.strictEqual(extra.timer, null);
    });
});
