/* eslint-disable max-statements */
import "should";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { beforeTest, afterTest, beforeEachTest, afterEachTest, UmbrellaTestContext } from "./_helper_umbrella";

const port = 1997;

describe("testing Client - Umbrella-D ", function (this: Mocha.Context) {
    // Allow extra time on slower hardware or under profiling/coverage
    this.timeout(process.arch === "arm" ? 400000 : 30000);
    this.timeout(Math.max(200000, this.timeout()));

    const test = this as UmbrellaTestContext;
    test.port = port;

    before(async () => beforeTest(test));
    beforeEach(async () => beforeEachTest(test));
    afterEach(async () => afterEachTest(test));
    after(async () => afterTest(test));

    // Sub-test registrations
    require("./u_test_e2e_monitoring_large_number_of_nodes").t(test);
    require("./u_test_e2e_ClientMonitoredItemGroup").t(test);
    require("./u_test_e2e_writeUseCase").t(test);
    require("./u_test_e2e_transfer_session").t(test);
    require("./u_test_e2e_registerNodes").t(test);
    require("./u_test_e2e_ctt_modifyMonitoredItems010").t(test);
    require("./u_test_e2e_monitored_item_with_timestamp_source_issue#804").t(test);
});

