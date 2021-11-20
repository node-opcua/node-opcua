"use strict";
const should = require("should");
const port = 2234;

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

    before((done) => beforeTest(test, done));
    beforeEach((done) => beforeEachTest(test, done));
    afterEach((done) => afterEachTest(test, done));
    after((done) => afterTest(test, done));

    require("./u_test_e2e_client")(test);

    require("./u_test_e2e_call_service")(test);
    require("./u_test_e2e_ClientSession_readVariableValue")(test);
    require("./u_test_e2e_client_node_crawler")(test);
});
