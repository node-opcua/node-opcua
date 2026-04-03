// Fixture: leaked setInterval — detector should report and clean it
const assert = require("node:assert");
const { describeWithLeakDetector } = require("../../src/resource_leak_detector");

describeWithLeakDetector("fixture-leaked-interval", () => {
    it("creates a leaked interval", () => {
        // Intentionally NOT cleared
        setInterval(() => {}, 30000);
        assert.ok(true);
    });
});
