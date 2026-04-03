// Fixture: leaked file descriptor (fs.open without close)
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { describeWithLeakDetector } = require("../../src/resource_leak_detector");

describeWithLeakDetector("fixture-leaked-fd", () => {
    it("opens a file and does NOT close it", () => {
        const fd = fs.openSync(path.join(__dirname, "fixture_pass.js"), "r");
        assert.ok(fd > 0);
        // Intentionally NOT calling fs.closeSync(fd)
    });
});
