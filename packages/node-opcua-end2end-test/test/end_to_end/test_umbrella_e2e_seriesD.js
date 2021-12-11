/* eslint-disable import/order */
/* eslint-disable max-statements */
"use strict";
/* global: describe, require */
const should = require("should");

const port = 1997;

const { beforeTest, afterTest, beforeEachTest, afterEachTest } = require("./_helper_umbrella");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Client - Umbrella-D ", function () {
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

    require("./u_test_e2e_monitoring_large_number_of_nodes")(test);
    require("./u_test_e2e_ClientMonitoredItemGroup")(test);
    require("./u_test_e2e_writeUseCase")(test);
    require("./u_test_e2e_transfer_session")(test);
    require("./u_test_e2e_registerNodes")(test);
    require("./u_test_e2e_ctt_modifyMonitoredItems010")(test);
    require("./u_test_e2e_monitored_item_with_timestamp_source_issue#804")(test);
});
