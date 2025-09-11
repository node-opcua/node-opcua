import "should";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import {
    beforeTest,
    afterTest,
    beforeEachTest,
    afterEachTest,
    UmbrellaTestContext
} from "./_helper_umbrella";

const port = 1999;

describe("testing Client - Umbrella-B ", function (this: Mocha.Context)
{
    // Increase timeout for slow environments (ARM, instrumentation, coverage)
    this.timeout(process.arch === "arm" ? 400000 : 30000);
    this.timeout(Math.max(200000, this.timeout()));

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const test = this as UmbrellaTestContext;
    test.port = port;

    before(async () => beforeTest(test));
    beforeEach(async () => beforeEachTest(test));
    afterEach(async () => afterEachTest(test));
    after(async () =>    afterTest(test));


    // typescripts tests starts here...
    require("./u_test_e2e_issue_610_timeoutHint_overflow").t(test);
    require("./u_test_e2e_sessionDiagnostics").t(test);
    require("./u_test_e2e_sessionDiagnostics2").t(test);
    require("./u_test_e2e_sessionSecurityDiagnostics").t(test);
    require("./u_test_e2e_issue_activate_an_expired_session").t(test);
    require("./u_test_e2e_server_behavior_on_wrong_channel_id").t(test);
    require("./u_test_e2e_test_accessing_service_before_session_is_activated").t(test);
    require("./alarms_and_conditions/u_test_e2e_conditions").t(test);
    require("./alarms_and_conditions/u_test_e2e_alarm_client_side").t(test);
    require("./u_test_e2e_monitoredItem_client_terminated_event").t(test);
    require("./u_test_e2e_endpoint_should_be_case_insensitive").t(test);
    require("./u_test_e2e_keepAlive").t(test);
    require("./u_test_e2e_createsSession_endpoints").t(test);
    require("./u_test_e2e_deadband_filter").t(test);
    require("./u_test_e2e_set_triggering").t(test);
    require("./u_test_e2e_write_large_array_range").t(test);
    require("./u_test_e2e_Subscription_modify_subscription").t(test);
    require("./u_test_e2e_monitoring_larger_number2").t(test);

});
