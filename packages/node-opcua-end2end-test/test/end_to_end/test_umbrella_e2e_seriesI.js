"use strict";
const should = require("should");
const port = 1978;
const { beforeTest, afterTest, beforeEachTest, afterEachTest } = require("./_helper_umbrella");
// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Client - Umbrella-I", function () {
    // this test could be particularly slow on RaspberryPi or BeagleBoneBlack
    // so we set a big enough timeout
    // execution time could also be affected by code running under profiling/coverage tools (istanbul)
    this.timeout(process.arch === "arm" ? 400000 : 30000);
    this.timeout(Math.max(30 * 1000, this.timeout()));

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const test = this;
    test.port = port;

    before(async () => await beforeTest(test));
    beforeEach(async () => await beforeEachTest(test));
    afterEach(async () => await afterEachTest(test));
    after(async () => await afterTest(test));

    //-----------
    require("./u_test_e2e_issue445_currentSessionCount")(test);
    require("./u_test_e2e_browse_read")(test);
    require("./u_test_e2e_ctt_582022")(test);
    require("./u_test_e2e_ctt_5.10.5_test3")(test);
    require("./u_test_e2e_cttt_5.10.2_test7")(test);
    require("./u_test_e2e_BrowseRequest")(test);
    require("./u_test_e2e_security_username_password")(test);
});
