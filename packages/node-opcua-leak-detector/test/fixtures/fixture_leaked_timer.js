// Fixture: leaked timer (ref'd) — detector should report and clean it
const assert = require("node:assert");
const { describeWithLeakDetector } = require("../../src/resource_leak_detector");

describeWithLeakDetector("fixture-leaked-timer", () => {
    it("creates a leaked ref'd timer", () => {
        // This timer is intentionally NOT cleared
        setTimeout(() => {}, 60000);
        assert.ok(true);
    });
});
