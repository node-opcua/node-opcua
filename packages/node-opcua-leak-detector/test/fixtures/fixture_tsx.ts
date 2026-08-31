// Fixture: TypeScript test — requires tsx to load
import assert from "node:assert";

import { describeWithLeakDetector } from "../../index.js";

describeWithLeakDetector("fixture-tsx", () => {
    it("runs TypeScript syntax", () => {
        const x: number = 42;
        assert.strictEqual(x, 42);
    });
    it("async TypeScript", async () => {
        const result: string = await Promise.resolve("ok");
        assert.strictEqual(result, "ok");
    });
});
