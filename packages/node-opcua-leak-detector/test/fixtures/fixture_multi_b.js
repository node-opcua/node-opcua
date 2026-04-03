// Fixture: multiple describe blocks across two files (block B)
const assert = require("node:assert");
const { describeWithLeakDetector } = require("../../src/resource_leak_detector");

describeWithLeakDetector("fixture-multi-B", () => {
    it("block B test 1", () => {
        assert.ok(true);
    });
    it("block B test 2", () => {
        assert.strictEqual(2 + 2, 4);
    });
});
