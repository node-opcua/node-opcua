/* eslint-disable max-statements */
"use strict";
/* global: describe, require */
const should = require("should");

const port = 1981;

const { beforeTest, afterTest, beforeEachTest, afterEachTest } = require("./_helper_umbrella");

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Client - Umbrella-J", function () {
    // this test could be particularly slow on RaspberryPi or BeagleBoneBlack
    // so we set a big enough timeout
    // execution time could also be affected by code running under profiling/coverage tools (istanbul)
    this.timeout(process.arch === "arm" ? 400*1000 : 20*1000);
    this.timeout(Math.max(20*10000, this.timeout()));

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const test = this;
    test.port = port;

    before(async () => await beforeTest(test));
    beforeEach(async () => await beforeEachTest(test));
    afterEach(async () => await afterEachTest(test));
    after(async () => await afterTest(test));
 
    require("./u_test_e2e_issue_205_betterSessionNames")(test);
    require("./u_test_e2e_issue_214_StatusValueTimestamp")(test);
    require("./u_test_e2e_translateBrowsePath")(test);
    require("./u_test_e2e_issue_73")(test);
    require("./u_test_e2e_issue_119")(test);
    require("./u_test_e2e_issue_141")(test);

    require("./u_test_e2e_issue_146")(test);
    require("./u_test_e2e_read_write")(test);
    require("./u_test_e2e_issue_957")(test);


});
