/**
 * T12 - A leak in one block must not fail the blocks that follow it.
 *
 * ObjectRegistry.registries is process-global and outlives any one block. The check used
 * to ask an absolute question of it ("is every registry empty?"), so the first package to
 * leak an object made every later describeWithLeakDetector block fail, reporting the leak
 * against an innocent test. In a per-process CI job that never showed; in a single-process
 * whole-suite run it produced hundreds of failures from one root cause.
 *
 * The block below leaks on purpose and is never cleaned up. Everything after it must still
 * pass, and must still catch a leak of its own.
 */

import assert from "node:assert";
import { ObjectRegistry } from "node-opcua-object-registry";
import { describeWithLeakDetector } from "../index.js";

class AbandonedResource {
    public static registry = new ObjectRegistry();
    public name: string;

    constructor(name: string) {
        this.name = name;
        AbandonedResource.registry.register(this);
    }

    dispose() {
        AbandonedResource.registry.unregister(this);
    }

    toString() {
        return `AbandonedResource(${this.name})`;
    }
}

// Held at module scope so the WeakRef in the registry cannot be collected: the leak has to
// still be there when the later blocks run, or the test would pass for the wrong reason.
const leaked: AbandonedResource[] = [];

describe("T12.A - a block that leaks an object and never disposes it", () => {
    it("T12.A.1 - leaks on purpose", () => {
        leaked.push(new AbandonedResource("abandoned"));
        assert.strictEqual(AbandonedResource.registry.count(), 1);
    });
});

describeWithLeakDetector("T12.B - a clean block running after the leak", () => {
    it("T12.B.1 - is not blamed for the earlier leak", () => {
        assert.strictEqual(AbandonedResource.registry.count(), 1, "the earlier leak is still there");
    });
});

describeWithLeakDetector("T12.C - a second clean block running after the leak", () => {
    it("T12.C.1 - is not blamed either", () => {
        assert.ok(true);
    });
});

describeWithLeakDetector("T12.D - a block that still detects its own leak", () => {
    it("T12.D.1 - a leak made inside the block is a delta above the baseline", () => {
        const before = AbandonedResource.registry.count();
        const mine = new AbandonedResource("mine");
        assert.strictEqual(AbandonedResource.registry.count(), before + 1);
        // dispose it here: this test asserts the delta is visible, not that the block fails
        mine.dispose();
        assert.strictEqual(AbandonedResource.registry.count(), before);
    });
});
