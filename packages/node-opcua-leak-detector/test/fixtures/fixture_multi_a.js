// Fixture: multiple describe blocks across two files (block A)
import assert from "node:assert";
import { describeWithLeakDetector } from "../../src/resource_leak_detector.js";

describeWithLeakDetector("fixture-multi-A", () => {
    it("block A test 1", () => {
        assert.ok(true);
    });
    it("block A test 2", async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        assert.ok(true);
    });
});
