import "should";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { afterEachTest, afterTest, beforeEachTest, beforeTest, type ReadyUmbrellaTestContext } from "./_helper_umbrella.js";
import { t as tE2e1086 } from "./u_test_e2e_1086.js";
import { t as tE2eIssue1018GetMonitoredItems } from "./u_test_e2e_issue1018_getMonitoredItems.js";

const port = 1989;

describe("testing Client - Umbrella-G", function (this: Mocha.Context) {
    // Allow extended timeout for slower hardware / coverage scenarios
    this.timeout(process.arch === "arm" ? 400_000 : 30_000);
    this.timeout(Math.max(200_000, this.timeout()));

    const test = this as ReadyUmbrellaTestContext;
    test.port = port;

    before(async () => beforeTest(test));
    beforeEach(async () => beforeEachTest(test));
    afterEach(async () => afterEachTest(test));
    after(async () => afterTest(test));

    tE2e1086(test);
    tE2eIssue1018GetMonitoredItems(test);
});
