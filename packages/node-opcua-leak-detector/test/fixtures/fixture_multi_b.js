// Fixture: multiple describe blocks across two files (block B)
import assert from "node:assert";
import { describeWithLeakDetector } from "../../src/resource_leak_detector.js";

describeWithLeakDetector("fixture-multi-B", () => {
    it("block B test 1", () => {
        assert.ok(true);
    });
    it("block B test 2", () => {
        assert.strictEqual(2 + 2, 4);
    });
});
