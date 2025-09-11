/* eslint-disable max-statements */
import "should";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { beforeTest, afterTest, beforeEachTest, afterEachTest, UmbrellaTestContext } from "./_helper_umbrella";

const port = 1981;

describe("testing Client - Umbrella-J", function (this: Mocha.Context) {
    this.timeout(process.arch === "arm" ? 400_000 : 20_000);
    this.timeout(Math.max(200_000, this.timeout()));

    const test = this as UmbrellaTestContext;
    test.port = port;

    before(async () => beforeTest(test));
    beforeEach(async () => beforeEachTest(test));
    afterEach(async () => afterEachTest(test));
    after(async () => afterTest(test));

    require("./u_test_e2e_issue_205_betterSessionNames").t(test);
    require("./u_test_e2e_issue_214_StatusValueTimestamp").t(test);
    require("./u_test_e2e_translateBrowsePath").t(test);
    require("./u_test_e2e_issue_73").t(test);
    require("./u_test_e2e_issue_119").t(test);
    require("./u_test_e2e_issue_141").t(test); // rather slow
    require("./u_test_e2e_issue_146").t(test);
    require("./u_test_e2e_read_write").t(test);
    require("./u_test_e2e_issue_957").t(test);
    require("./u_test_e2e_multiple_disconnection").t(test);
});

