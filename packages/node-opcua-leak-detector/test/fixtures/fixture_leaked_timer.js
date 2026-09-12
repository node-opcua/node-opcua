// Fixture: leaked timer (ref'd) — detector should report and clean it
import assert from "node:assert";
import { describeWithLeakDetector } from "../../src/resource_leak_detector.js";

describeWithLeakDetector("fixture-leaked-timer", () => {
    it("creates a leaked ref'd timer", () => {
        // This timer is intentionally NOT cleared
        setTimeout(() => {}, 60000);
        assert.ok(true);
    });
});
