import "should";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { afterEachTest, afterTest, beforeEachTest, beforeTest, type ReadyUmbrellaTestContext } from "./_helper_umbrella.js";
import { t as tE2eReadHistoryServerCapabilities } from "./u_test_e2e_ read_history_server_capabilities.js";
import { t as tE2eClientSessionReadVariableValue } from "./u_test_e2e_ClientSession_readVariableValue.js";
import { t as tE2eCallService } from "./u_test_e2e_call_service.js";
import { t as tE2eClient } from "./u_test_e2e_client.js";
import { t as tE2eClientNodeCrawler } from "./u_test_e2e_client_node_crawler.js";

const port = 1311;

describe("testing Client - Umbrella-A ", function (this: Mocha.Context) {
    // Increase timeout for slow environments (ARM, instrumentation, coverage)
    this.timeout(process.arch === "arm" ? 400000 : 30000);
    this.timeout(Math.max(200000, this.timeout()));

    const test = this as ReadyUmbrellaTestContext;
    test.port = port;

    before(async () => beforeTest(test));
    beforeEach(async () => beforeEachTest(test));
    afterEach(async () => afterEachTest(test));
    after(async () => afterTest(test));

    // Load individual test modules (each exports function t(test))
    tE2eClient(test);
    tE2eCallService(test);
    tE2eClientSessionReadVariableValue(test);
    tE2eClientNodeCrawler(test);
    tE2eReadHistoryServerCapabilities(test);
});
