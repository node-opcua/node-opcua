/* eslint-disable max-statements */
import "should";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { beforeTest, afterTest, beforeEachTest, afterEachTest, UmbrellaTestContext } from "./_helper_umbrella";

const port = 1995;

describe("testing Client - Umbrella-F", function (this: Mocha.Context) {
    // Allow extended timeout for slower hardware / coverage
    this.timeout(process.arch === "arm" ? 400_000 : 20_000);
    this.timeout(Math.max(200_000, this.timeout()));

    const test = this as UmbrellaTestContext;
    test.port = port;

    before(async () => beforeTest(test));
    beforeEach(async () => beforeEachTest(test));
    afterEach(async () => afterEachTest(test));
    after(async () => afterTest(test));

    // OPCUA Event Monitoring test cases
    require("./u_test_e2e_issue_144").t(test);
    require("./u_test_e2e_issue_156").t(test);
    require("./u_test_e2e_issue_123").t(test);
    require("./u_test_e2e_issue_163").t(test);
    require("./u_test_e2e_issue_135_currentMonitoredItemsCount").t(test);
    require("./u_test_e2e_issue_192").t(test);
    require("./u_test_e2e_issue_195").t(test);
    require("./u_test_e2e_issue_198").t(test);
});

