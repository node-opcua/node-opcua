import "should";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { afterEachTest, afterTest, beforeEachTest, beforeTest, type ReadyUmbrellaTestContext } from "./_helper_umbrella.js";
import { t as tE2eIssue73 } from "./u_test_e2e_issue_73.js";
import { t as tE2eIssue119 } from "./u_test_e2e_issue_119.js";
import { t as tE2eIssue141 } from "./u_test_e2e_issue_141.js";
import { t as tE2eIssue146 } from "./u_test_e2e_issue_146.js";
import { t as tE2eIssue205BetterSessionNames } from "./u_test_e2e_issue_205_betterSessionNames.js";
import { t as tE2eIssue214StatusValueTimestamp } from "./u_test_e2e_issue_214_StatusValueTimestamp.js";
import { t as tE2eIssue957 } from "./u_test_e2e_issue_957.js";
import { t as tE2eMultipleDisconnection } from "./u_test_e2e_multiple_disconnection.js";
import { t as tE2eReadWrite } from "./u_test_e2e_read_write.js";
import { t as tE2eTranslateBrowsePath } from "./u_test_e2e_translateBrowsePath.js";

const port = 1981;

describe("testing Client - Umbrella-J", function (this: Mocha.Context) {
    this.timeout(process.arch === "arm" ? 400_000 : 20_000);
    this.timeout(Math.max(200_000, this.timeout()));

    const test = this as ReadyUmbrellaTestContext;
    test.port = port;

    before(async () => beforeTest(test));
    beforeEach(async () => beforeEachTest(test));
    afterEach(async () => afterEachTest(test));
    after(async () => afterTest(test));

    tE2eIssue205BetterSessionNames(test);
    tE2eIssue214StatusValueTimestamp(test);
    tE2eTranslateBrowsePath(test);
    tE2eIssue73(test);
    tE2eIssue119(test);
    tE2eIssue141(test); // rather slow
    tE2eIssue146(test);
    tE2eReadWrite(test);
    tE2eIssue957(test);
    tE2eMultipleDisconnection(test);
});
