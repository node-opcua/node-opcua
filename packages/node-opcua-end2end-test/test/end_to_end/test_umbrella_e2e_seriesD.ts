import "should";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { afterEachTest, afterTest, beforeEachTest, beforeTest, type ReadyUmbrellaTestContext } from "./_helper_umbrella.js";
import { t as tE2eClientMonitoredItemGroup } from "./u_test_e2e_ClientMonitoredItemGroup.js";
import { t as tE2eCttModifyMonitoredItems010 } from "./u_test_e2e_ctt_modifyMonitoredItems010.js";
import { t as tE2eMonitoredItemWithTimestampSourceIssue804 } from "./u_test_e2e_monitored_item_with_timestamp_source_issue#804.js";
import { t as tE2eMonitoringLargeNumberOfNodes } from "./u_test_e2e_monitoring_large_number_of_nodes.js";
import { t as tE2eRegisterNodes } from "./u_test_e2e_registerNodes.js";
import { t as tE2eTransferSession } from "./u_test_e2e_transfer_session.js";
import { t as tE2eWriteUseCase } from "./u_test_e2e_writeUseCase.js";

const port = 1997;

describe("testing Client - Umbrella-D ", function (this: Mocha.Context) {
    // Allow extra time on slower hardware or under profiling/coverage
    this.timeout(process.arch === "arm" ? 400000 : 30000);
    this.timeout(Math.max(200000, this.timeout()));

    const test = this as ReadyUmbrellaTestContext;
    test.port = port;

    before(async () => beforeTest(test));
    beforeEach(async () => beforeEachTest(test));
    afterEach(async () => afterEachTest(test));
    after(async () => afterTest(test));

    // Sub-test registrations
    tE2eMonitoringLargeNumberOfNodes(test);
    tE2eClientMonitoredItemGroup(test);
    tE2eWriteUseCase(test);
    tE2eTransferSession(test);
    tE2eRegisterNodes(test);
    tE2eCttModifyMonitoredItems010(test);
    tE2eMonitoredItemWithTimestampSourceIssue804(test);
});
