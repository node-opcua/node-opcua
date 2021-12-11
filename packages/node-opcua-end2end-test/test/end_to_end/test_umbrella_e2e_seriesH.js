/* eslint-disable max-statements */
"use strict";
/* global: describe, require */
const should = require("should");

const port = 1994;

const { beforeTest, afterTest, beforeEachTest, afterEachTest } = require("./_helper_umbrella");

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Client - Umbrella-H", function () {
    // this test could be particularly slow on RaspberryPi or BeagleBoneBlack
    // so we set a big enough timeout
    // execution time could also be affected by code running under profiling/coverage tools (istanbul)
    this.timeout(process.arch === "arm" ? 400000 : 30000);
    this.timeout(Math.max(200000, this.timeout()));

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const test = this;
    test.port = port;

    before(async () => await beforeTest(test));
    beforeEach(async () => await beforeEachTest(test));
    afterEach(async () => await afterEachTest(test));
    after(async () => await afterTest(test));

    require("./u_test_e2e_SubscriptionUseCase_monitoring_events")(test);
    //xx require("./u_test_e2e_SubscriptionUseCase_monitoring_events_2")(test);
    require("./u_test_e2e_monitored_item_ctt018").t(test);
    require("./u_test_e2e_server_with_500_clients")(test);
    // require("./u_test_e2e_modifyMonitoredItem_onEvent")(test);

});
