import "should";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { afterEachTest, afterTest, beforeEachTest, beforeTest, type ReadyUmbrellaTestContext } from "./_helper_umbrella.js";
import { t as tE2eBrowseRequest } from "./u_test_e2e_BrowseRequest.js";
import { t as tE2eBrowseRead } from "./u_test_e2e_browse_read.js";
import { t as tE2eCtt5102Test7 } from "./u_test_e2e_ctt_5.10.2_test7.js";
import { t as tE2eCtt5105Test3 } from "./u_test_e2e_ctt_5.10.5_test3.js";
import { t as tE2eCtt582022 } from "./u_test_e2e_ctt_582022.js";
import { t as tE2eIssue445CurrentSessionCount } from "./u_test_e2e_issue_445_currentSessionCount.js";
import { t as tE2eSecurityUsernamePassword } from "./u_test_e2e_security_username_password.js";

const port = 1978;

describe("testing Client - Umbrella-I", function (this: Mocha.Context) {
    this.timeout(process.arch === "arm" ? 400_000 : 30_000);
    this.timeout(Math.max(30_000, this.timeout()));

    const test = this as ReadyUmbrellaTestContext;
    test.port = port;

    before(async () => beforeTest(test));
    beforeEach(async () => beforeEachTest(test));
    afterEach(async () => afterEachTest(test));
    after(async () => afterTest(test));

    tE2eIssue445CurrentSessionCount(test);
    tE2eBrowseRead(test);
    tE2eCtt582022(test);
    tE2eCtt5105Test3(test);
    tE2eCtt5102Test7(test);
    tE2eBrowseRequest(test);
    tE2eSecurityUsernamePassword(test);
});
