// Fixture: all tests pass, no leaks
const assert = require("node:assert");
const { describeWithLeakDetector } = require("../../src/resource_leak_detector");

describeWithLeakDetector("fixture-pass", () => {
    it("passes", () => {
        assert.ok(true);
    });
    it("passes async", async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        assert.ok(true);
    });
});
