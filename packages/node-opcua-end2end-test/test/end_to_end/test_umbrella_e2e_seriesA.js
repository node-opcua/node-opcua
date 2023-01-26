"use strict";
const should = require("should");
const port = 1311;

const { beforeTest, afterTest, beforeEachTest, afterEachTest } = require("./_helper_umbrella");

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Client - Umbrella-A ", function () {
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

    require("./u_test_e2e_client").t(test);

    require("./u_test_e2e_call_service")(test);
    require("./u_test_e2e_ClientSession_readVariableValue")(test);
    require("./u_test_e2e_client_node_crawler")(test);
});
