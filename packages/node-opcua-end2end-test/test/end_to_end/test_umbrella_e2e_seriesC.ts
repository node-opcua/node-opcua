import "should";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { afterEachTest, afterTest, beforeEachTest, beforeTest, type ReadyUmbrellaTestContext } from "./_helper_umbrella.js";
import { t as tE2eBrowseRequestIssue } from "./u_test_e2e_browse_request_issue.js";
import { t as tE2eClosingUnactivatedSession } from "./u_test_e2e_closing_unactivated_session.js";
import { t as tE2eIssue223DemonstrateClientCallService } from "./u_test_e2e_issue_223_demonstrate_client_call_service.js";
import { t as tE2eIssue231ProtocolVersion } from "./u_test_e2e_issue_231_protocolVersion.js";
import { t as tE2eIssue233 } from "./u_test_e2e_issue_233.js";
import { t as tE2eIssue273 } from "./u_test_e2e_issue_273.js";
import { t as tE2eIssue313 } from "./u_test_e2e_issue_313.js";
import { t as tE2eIssue355 } from "./u_test_e2e_issue_355.js";
import { t as tE2eIssue377 } from "./u_test_e2e_issue_377.js";
import { t as tE2eIssue417 } from "./u_test_e2e_issue_417.js";
import { t as tE2eIssue433 } from "./u_test_e2e_issue_433.js";
import { t as tE2eIssue455 } from "./u_test_e2e_issue_455.js";
import { t as tE2eIssue596 } from "./u_test_e2e_issue_596.js";
import { t as tE2eMonitoredItemSemanticChanged } from "./u_test_e2e_monitored_item_semantic_changed.js";
import { t as tE2eSubscriptionTransfer } from "./u_test_e2e_Subscription_Transfer.js";
import { t as tE2eSubscriptionDiagnostics } from "./u_test_e2e_SubscriptionDiagnostics.js";
import { t as tE2eServerConnectionWith500Sessions } from "./u_test_e2e_server_connection_with_500_sessions.js";
import { t as tE2eSessionAuditEvents } from "./u_test_e2e_session_audit_events.js";
import { t as tE2eTimeoutSession } from "./u_test_e2e_timeout_session.js";

const port = 2522;

describe("testing Client - Umbrella-C", function (this: Mocha.Context) {
    // Allow extra time on slower hardware or under coverage tools
    this.timeout(process.arch === "arm" ? 400000 : 30000);
    this.timeout(Math.max(200000, this.timeout()));

    const test = this as ReadyUmbrellaTestContext;
    test.port = port;

    before(async () => beforeTest(test));
    beforeEach(async () => beforeEachTest(test));
    afterEach(async () => afterEachTest(test));
    after(async () => afterTest(test));

    // Register grouped end-to-end sub-tests
    tE2eServerConnectionWith500Sessions(test);
    tE2eSubscriptionDiagnostics(test);
    tE2eBrowseRequestIssue(test);
    tE2eTimeoutSession(test);
    tE2eSessionAuditEvents(test);
    tE2eClosingUnactivatedSession(test);
    tE2eIssue223DemonstrateClientCallService(test);
    tE2eSubscriptionTransfer(test);
    tE2eIssue231ProtocolVersion(test);
    tE2eMonitoredItemSemanticChanged(test);
    tE2eIssue233(test);
    tE2eIssue273(test);
    tE2eIssue313(test);
    tE2eIssue355(test);
    tE2eIssue377(test);
    tE2eIssue417(test);
    tE2eIssue433(test);
    tE2eIssue455(test);
    tE2eIssue596(test);
});
