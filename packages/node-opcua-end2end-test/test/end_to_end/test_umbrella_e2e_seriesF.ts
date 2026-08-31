import "should";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { afterEachTest, afterTest, beforeEachTest, beforeTest, type ReadyUmbrellaTestContext } from "./_helper_umbrella.js";
import { t as tE2eIssue123 } from "./u_test_e2e_issue_123.js";
import { t as tE2eIssue135CurrentMonitoredItemsCount } from "./u_test_e2e_issue_135_currentMonitoredItemsCount.js";
import { t as tE2eIssue144 } from "./u_test_e2e_issue_144.js";
import { t as tE2eIssue156 } from "./u_test_e2e_issue_156.js";
import { t as tE2eIssue163 } from "./u_test_e2e_issue_163.js";
import { t as tE2eIssue192 } from "./u_test_e2e_issue_192.js";
import { t as tE2eIssue195 } from "./u_test_e2e_issue_195.js";
import { t as tE2eIssue198 } from "./u_test_e2e_issue_198.js";

const port = 1995;

describe("testing Client - Umbrella-F", function (this: Mocha.Context) {
    // Allow extended timeout for slower hardware / coverage
    this.timeout(process.arch === "arm" ? 400_000 : 20_000);
    this.timeout(Math.max(200_000, this.timeout()));

    const test = this as ReadyUmbrellaTestContext;
    test.port = port;

    before(async () => beforeTest(test));
    beforeEach(async () => beforeEachTest(test));
    afterEach(async () => afterEachTest(test));
    after(async () => afterTest(test));

    // OPCUA Event Monitoring test cases
    tE2eIssue144(test);
    tE2eIssue156(test);
    tE2eIssue123(test);
    tE2eIssue163(test);
    tE2eIssue135CurrentMonitoredItemsCount(test);
    tE2eIssue192(test);
    tE2eIssue195(test);
    tE2eIssue198(test);
});
