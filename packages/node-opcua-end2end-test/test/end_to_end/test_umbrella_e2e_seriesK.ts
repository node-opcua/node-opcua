import "should";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { afterEachTest, afterTest, beforeEachTest, beforeTest, type ReadyUmbrellaTestContext } from "./_helper_umbrella.js";
import { t as tE2eIssue1375 } from "./u_test_e2e_issue_1375.js";
import { t as tE2eMonitoredItemLongProcessing } from "./u_test_e2e_monitored_item_long_processing.js";
import { t as tE2eSubscriptionUseCaseResendData } from "./u_test_e2e_SubscriptionUseCase_ResendData.js";

const port = 1982;

describe("testing Client - Umbrella-K", function (this: Mocha.Context) {
    this.timeout(process.arch === "arm" ? 400_000 : 20_000);
    this.timeout(Math.max(200_000, this.timeout()));

    const test = this as ReadyUmbrellaTestContext;
    test.port = port;

    before(async () => beforeTest(test));
    beforeEach(async () => beforeEachTest(test));
    afterEach(async () => afterEachTest(test));
    after(async () => afterTest(test));

    tE2eSubscriptionUseCaseResendData(test);
    tE2eMonitoredItemLongProcessing(test);
    tE2eIssue1375(test);
});
