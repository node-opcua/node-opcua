// Fixture: multiple describe blocks across two files (block A)
const assert = require("node:assert");
const { describeWithLeakDetector } = require("../../src/resource_leak_detector");

describeWithLeakDetector("fixture-multi-A", () => {
    it("block A test 1", () => {
        assert.ok(true);
    });
    it("block A test 2", async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        assert.ok(true);
    });
});
