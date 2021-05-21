/* eslint-disable max-statements */
"use strict";
/* global: describe, require */
const should = require("should");


const port = 1999;

const { beforeTest, afterTest, beforeEachTest, afterEachTest } = require("./_helper_umbrella");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Client - Umbrella-B ", function() {
    // this test could be particularly slow on RaspberryPi or BeagleBoneBlack
    // so we set a big enough timeout
    // execution time could also be affected by code running under profiling/coverage tools (istanbul)
    this.timeout(process.arch === "arm" ? 400000 : 30000);
    this.timeout(Math.max(200000, this.timeout()));

    const test = this;
    test.port = port;

    before((done) => beforeTest(test, done));
    beforeEach((done) => beforeEachTest(test, done));
    afterEach((done) => afterEachTest(test, done));
    after((done) => afterTest(test, done));


    require("./u_test_e2e_issue_610_timeoutHint_overflow")(test);
    require("./u_test_e2e_sessionDiagnostics")(test);
    require("./u_test_e2e_sessionDiagnostics2")(test);
    require("./u_test_e2e_sessionSecurityDiagnostics")(test);
    require("./u_test_e2e_issue_activate_an_expired_session")(test);
    require("./u_test_e2e_server_behavior_on_wrong_channel_id")(test);
    require("./u_test_e2e_test_accessing_service_before_session_is_activated")(test);
    require("./alarms_and_conditions/u_test_e2e_conditions")(test);
    require("./alarms_and_conditions/u_test_e2e_alarm_client_side")(test);

    require("./u_test_e2e_monitoredItem_client_terminated_event")(test);
    require("./u_test_e2e_endpoint_should_be_case_insensitive")(test);
    require("./u_test_e2e_keepAlive")(test);
    require("./u_test_e2e_createsSession_endpoints")(test);

    // typescripts tests starts here...
    require("./u_test_e2e_deadband_filter").t(test);
    require("./u_test_e2e_set_triggering").t(test);
    require("./u_test_e2e_write_large_array_range").t(test);
    require("./u_test_e2e_Subscription_modify_subscription").t(test);
    require("./u_test_e2e_monitoring_larger_number2").t(test);

});
