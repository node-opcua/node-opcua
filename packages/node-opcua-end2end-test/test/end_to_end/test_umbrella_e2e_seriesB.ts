import "should";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { afterEachTest, afterTest, beforeEachTest, beforeTest, type ReadyUmbrellaTestContext } from "./_helper_umbrella.js";
import { t as tE2eAlarmClientSide } from "./alarms_and_conditions/u_test_e2e_alarm_client_side.js";
import { t as tE2eConditions } from "./alarms_and_conditions/u_test_e2e_conditions.js";
import { t as tE2eCreatesSessionEndpoints } from "./u_test_e2e_createsSession_endpoints.js";
import { t as tE2eDeadbandFilter } from "./u_test_e2e_deadband_filter.js";
import { t as tE2eEndpointShouldBeCaseInsensitive } from "./u_test_e2e_endpoint_should_be_case_insensitive.js";
import { t as tE2eIssue610TimeoutHintOverflow } from "./u_test_e2e_issue_610_timeoutHint_overflow.js";
import { t as tE2eIssueActivateAnExpiredSession } from "./u_test_e2e_issue_activate_an_expired_session.js";
import { t as tE2eKeepAlive } from "./u_test_e2e_keepAlive.js";
import { t as tE2eMonitoredItemClientTerminatedEvent } from "./u_test_e2e_monitoredItem_client_terminated_event.js";
import { t as tE2eMonitoringLargerNumber2 } from "./u_test_e2e_monitoring_larger_number2.js";
import { t as tE2eSubscriptionModifySubscription } from "./u_test_e2e_Subscription_modify_subscription.js";
import { t as tE2eServerBehaviorOnWrongChannelId } from "./u_test_e2e_server_behavior_on_wrong_channel_id.js";
import { t as tE2eSessionDiagnostics } from "./u_test_e2e_sessionDiagnostics.js";
import { t as tE2eSessionDiagnostics2 } from "./u_test_e2e_sessionDiagnostics2.js";
import { t as tE2eSessionSecurityDiagnostics } from "./u_test_e2e_sessionSecurityDiagnostics.js";
import { t as tE2eSetTriggering } from "./u_test_e2e_set_triggering.js";
import { t as tE2eTestAccessingServiceBeforeSessionIsActivated } from "./u_test_e2e_test_accessing_service_before_session_is_activated.js";
import { t as tE2eWriteLargeArrayRange } from "./u_test_e2e_write_large_array_range.js";

const port = 1999;

describe("testing Client - Umbrella-B ", function (this: Mocha.Context) {
    // Increase timeout for slow environments (ARM, instrumentation, coverage)
    this.timeout(process.arch === "arm" ? 400000 : 30000);
    this.timeout(Math.max(200000, this.timeout()));

    const test = this as ReadyUmbrellaTestContext;
    test.port = port;

    before(async () => beforeTest(test));
    beforeEach(async () => beforeEachTest(test));
    afterEach(async () => afterEachTest(test));
    after(async () => afterTest(test));

    // typescripts tests starts here...
    tE2eIssue610TimeoutHintOverflow(test);
    tE2eSessionDiagnostics(test);
    tE2eSessionDiagnostics2(test);
    tE2eSessionSecurityDiagnostics(test);
    tE2eIssueActivateAnExpiredSession(test);
    tE2eServerBehaviorOnWrongChannelId(test);
    tE2eTestAccessingServiceBeforeSessionIsActivated(test);
    tE2eConditions(test);
    tE2eAlarmClientSide(test);
    tE2eMonitoredItemClientTerminatedEvent(test);
    tE2eEndpointShouldBeCaseInsensitive(test);
    tE2eKeepAlive(test);
    tE2eCreatesSessionEndpoints(test);
    tE2eDeadbandFilter(test);
    tE2eSetTriggering(test);
    tE2eWriteLargeArrayRange(test);
    tE2eSubscriptionModifySubscription(test);
    tE2eMonitoringLargerNumber2(test);
});
