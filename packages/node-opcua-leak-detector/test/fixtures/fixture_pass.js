// Fixture: all tests pass, no leaks
import assert from "node:assert";
import { describeWithLeakDetector } from "../../src/resource_leak_detector.js";

describeWithLeakDetector("fixture-pass", () => {
    it("passes", () => {
        assert.ok(true);
    });
    it("passes async", async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        assert.ok(true);
    });
});
