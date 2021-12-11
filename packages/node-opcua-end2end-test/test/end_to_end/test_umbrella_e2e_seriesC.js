/* eslint-disable max-statements */
"use strict";
/* global: describe, require */
const should = require("should");

const port = 1998;
const { beforeTest, afterTest, beforeEachTest, afterEachTest } = require("./_helper_umbrella");

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Client - Umbrella-C", function () {
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

    require("./u_test_e2e_server_connection_with_500_sessions")(test);
    require("./u_test_e2e_SubscriptionDiagnostics")(test);
    require("./u_test_e2e_browse_request_issue")(test);
    require("./u_test_e2e_timeout_session")(test);
    require("./u_test_e2e_session_audit_events")(test);
    require("./u_test_e2e_closing_unactivated_session")(test);
    require("./u_test_e2e_issue_223_demonstrate_client_call_service")(test);
    require("./u_test_e2e_Subscription_Transfer")(test);
    require("./u_test_e2e_issue_231_protocolVersion")(test);
    require("./u_test_e2e_monitored_item_semantic_changed")(test);
    require("./u_test_e2e_issue_233")(test);
    require("./u_test_e2e_issue_273")(test);
    require("./u_test_e2e_issue_313")(test);
    require("./u_test_e2e_issue_355")(test);
    require("./u_test_e2e_issue_377")(test);
    require("./u_test_e2e_issue_417")(test);
    require("./u_test_e2e_issue_433")(test);
    require("./u_test_e2e_issue_455")(test);
    require("./u_test_e2e_issue_596")(test);
});
