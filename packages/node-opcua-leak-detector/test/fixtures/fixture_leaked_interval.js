// Fixture: leaked setInterval — detector should report and clean it
import assert from "node:assert";
import { describeWithLeakDetector } from "../../src/resource_leak_detector.js";

describeWithLeakDetector("fixture-leaked-interval", () => {
    it("creates a leaked interval", () => {
        // Intentionally NOT cleared
        setInterval(() => {}, 30000);
        assert.ok(true);
    });
});
