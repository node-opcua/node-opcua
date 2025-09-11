/* eslint-disable max-statements */
import "should";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { beforeTest, afterTest, beforeEachTest, afterEachTest, UmbrellaTestContext } from "./_helper_umbrella";

const port = 1982;

describe("testing Client - Umbrella-K", function (this: Mocha.Context) {
    this.timeout(process.arch === "arm" ? 400_000 : 20_000);
    this.timeout(Math.max(200_000, this.timeout()));

    const test = this as UmbrellaTestContext;
    test.port = port;

    before(async () => beforeTest(test));
    beforeEach(async () => beforeEachTest(test));
    afterEach(async () => afterEachTest(test));
    after(async () => afterTest(test));

    require("./u_test_e2e_SubscriptionUseCase_ResendData").t(test);
    require("./u_test_e2e_monitored_item_long_processing").t(test);
    require("./u_test_e2e_issue_1375").t(test);
});

