/* eslint-disable max-statements */
"use strict";
/* global: describe, require */
const should = require("should");


const port = 1997;

const { beforeTest, afterTest, beforeEachTest, afterEachTest } = require("./_helper_umbrella");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Client - Umbrella-D ", function() {
    // this test could be particularly slow on RaspberryPi or BeagleBoneBlack
    // so we set a big enough timeout
    // execution time could also be affected by code running under profiling/coverage tools (istanbul)
    this.timeout(process.arch === "arm" ? 400000 : 30000);
    this.timeout(Math.max(200000, this.timeout()));

    const test = this;
    test.port = port;

    before((done)     => beforeTest(test,done));
    beforeEach((done) => beforeEachTest(test,done));
    afterEach((done)  => afterEachTest(test,done));
    after((done)      => afterTest(test,done));
    
    require("./u_test_e2e_monitoring_large_number_of_nodes")(test);
    require("./u_test_e2e_ClientMonitoredItemGroup")(test);
    require("./u_test_e2e_writeUseCase")(test);
    require("./u_test_e2e_transfer_session")(test);
    require("./u_test_e2e_registerNodes")(test);
    require("./u_test_e2e_ctt_modifyMonitoredItems010")(test);
    require("./u_test_e2e_monitored_item_with_timestamp_source_issue#804")(test);
    require("./u_test_e2e_issue445_currentSessionCount")(test);
    require("./u_test_e2e_browse_read")(test);
    require("./u_test_e2e_ctt_582022")(test);
    require("./u_test_e2e_ctt_5.10.5_test3")(test);
    require("./u_test_e2e_cttt_5.10.2_test7")(test);
    require("./u_test_e2e_BrowseRequest")(test);
    require("./u_test_e2e_security_username_password")(test);
 });
