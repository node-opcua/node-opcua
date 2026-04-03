// Fixture: TypeScript with leaked timer — proves tsx + leak combo exits
import assert from "node:assert";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { describeWithLeakDetector } = require("../../src/resource_leak_detector");

describeWithLeakDetector("fixture-tsx-leaked", () => {
    it("TypeScript test with leaked timer", () => {
        const x: number = 42;
        // Intentionally leaked
        setTimeout(() => {}, 60000);
        assert.strictEqual(x, 42);
    });
});

describeWithLeakDetector("fixture-tsx-second-block", () => {
    it("second tsx block runs after leaked timer", async () => {
        const result: string = await Promise.resolve("ok");
        assert.strictEqual(result, "ok");
    });
});
