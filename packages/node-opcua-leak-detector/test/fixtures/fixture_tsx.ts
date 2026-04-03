// Fixture: TypeScript test — requires tsx to load
import assert from "node:assert";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { describeWithLeakDetector } = require("../../src/resource_leak_detector");

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
