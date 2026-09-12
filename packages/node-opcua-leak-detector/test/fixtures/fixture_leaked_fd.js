// Fixture: leaked file descriptor (fs.open without close)
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { describeWithLeakDetector } from "../../src/resource_leak_detector.js";

describeWithLeakDetector("fixture-leaked-fd", () => {
    it("opens a file and does NOT close it", () => {
        const fd = fs.openSync(path.join(import.meta.dirname, "fixture_pass.js"), "r");
        assert.ok(fd > 0);
        // Intentionally NOT calling fs.closeSync(fd)
    });
});
