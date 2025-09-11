/* eslint-disable max-statements */
import "should";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { beforeTest, afterTest, beforeEachTest, afterEachTest, UmbrellaTestContext } from "./_helper_umbrella";

const port = 2522;

describe("testing Client - Umbrella-C", function (this: Mocha.Context) {
    // Allow extra time on slower hardware or under coverage tools
    this.timeout(process.arch === "arm" ? 400000 : 30000);
    this.timeout(Math.max(200000, this.timeout()));

    const test = this as UmbrellaTestContext;
    test.port = port;

    before(async () => beforeTest(test));
    beforeEach(async () => beforeEachTest(test));
    afterEach(async () => afterEachTest(test));
    after(async () => afterTest(test));

    // Register grouped end-to-end sub-tests
    require("./u_test_e2e_server_connection_with_500_sessions").t(test);
    require("./u_test_e2e_SubscriptionDiagnostics").t(test);
    require("./u_test_e2e_browse_request_issue").t(test);
    require("./u_test_e2e_timeout_session").t(test);
    require("./u_test_e2e_session_audit_events").t(test);
    require("./u_test_e2e_closing_unactivated_session").t(test);
    require("./u_test_e2e_issue_223_demonstrate_client_call_service").t(test);
    require("./u_test_e2e_Subscription_Transfer").t(test);
    require("./u_test_e2e_issue_231_protocolVersion").t(test);
    require("./u_test_e2e_monitored_item_semantic_changed").t(test);
    require("./u_test_e2e_issue_233").t(test);
    require("./u_test_e2e_issue_273").t(test);
    require("./u_test_e2e_issue_313").t(test);
    require("./u_test_e2e_issue_355").t(test);
    require("./u_test_e2e_issue_377").t(test);
    require("./u_test_e2e_issue_417").t(test);
    require("./u_test_e2e_issue_433").t(test);
    require("./u_test_e2e_issue_455").t(test);
    require("./u_test_e2e_issue_596").t(test);
});

