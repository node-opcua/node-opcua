import "should";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import {
    beforeTest,
    afterTest,
    beforeEachTest,
    afterEachTest,
    UmbrellaTestContext
} from "./_helper_umbrella";

const port = 1311;

describe("testing Client - Umbrella-A ", function (this: Mocha.Context) {
    // Increase timeout for slow environments (ARM, instrumentation, coverage)
    this.timeout(process.arch === "arm" ? 400000 : 30000);
    this.timeout(Math.max(200000, this.timeout()));

    const test = this as UmbrellaTestContext;
    test.port = port;

    before(async () => beforeTest(test));
    beforeEach(async () => beforeEachTest(test));
    afterEach(async () => afterEachTest(test));
    after(async () => afterTest(test));

    // Load individual test modules (each exports function t(test))
    require("./u_test_e2e_client").t(test);
    require("./u_test_e2e_call_service").t(test);
    require("./u_test_e2e_ClientSession_readVariableValue").t(test);
    require("./u_test_e2e_client_node_crawler").t(test);
    require("./u_test_e2e_ read_history_server_capabilities").t(test);
});
