/* eslint-disable max-statements */
import "should";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { beforeTest, afterTest, beforeEachTest, afterEachTest, UmbrellaTestContext } from "./_helper_umbrella";

const port = 1994;

describe("testing Client - Umbrella-H", function (this: Mocha.Context) {
    this.timeout(process.arch === "arm" ? 400_000 : 30_000);
    this.timeout(Math.max(200_000, this.timeout()));

    const test = this as UmbrellaTestContext;
    test.port = port;

    before(async () => beforeTest(test));
    beforeEach(async () => beforeEachTest(test));
    afterEach(async () => afterEachTest(test));
    after(async () => afterTest(test));

    require("./u_test_e2e_SubscriptionUseCase_monitoring_events").t(test);
    require("./u_test_e2e_monitored_item_ctt018").t(test);
    require("./u_test_e2e_server_with_500_clients").t(test);
    require("./u_test_e2e_modifyMonitoredItem_onEvent").t(test);
});

