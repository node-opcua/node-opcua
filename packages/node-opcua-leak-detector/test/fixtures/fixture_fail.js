// Fixture: a test fails
import assert from "node:assert";
import { describeWithLeakDetector } from "../../src/resource_leak_detector.js";

describeWithLeakDetector("fixture-fail", () => {
    it("passes first", () => {
        assert.ok(true);
    });
    it("fails intentionally", () => {
        assert.strictEqual(1, 2, "intentional failure");
    });
    it("passes after failure", () => {
        assert.ok(true);
    });
});
