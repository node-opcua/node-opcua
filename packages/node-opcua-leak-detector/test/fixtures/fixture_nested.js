// Fixture: nested describes using describeWithLeakDetector everywhere
// This mimics how real test files alias describe = describeWithLeakDetector
const assert = require("node:assert");
const { describeWithLeakDetector } = require("../../src/resource_leak_detector");
const describe = describeWithLeakDetector;

describe("fixture-nested-outer", () => {

    describe("nested-level-1", () => {
        describe("nested-level-2", () => {
            it("deeply nested test", () => {
                assert.ok(true);
            });
        });
        it("level-1 test", () => {
            assert.strictEqual(1, 1);
        });
    });

    describe("sibling-level-1", () => {
        it("sibling test", async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            assert.ok(true);
        });
    });
});

describe("fixture-nested-second-block", () => {
    it("second block after nested", () => {
        assert.ok(true);
    });
});
