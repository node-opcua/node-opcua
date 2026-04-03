// Fixture: a test fails
const assert = require("node:assert");
const { describeWithLeakDetector } = require("../../src/resource_leak_detector");

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
