import "should";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { beforeTest, afterTest, beforeEachTest, afterEachTest, UmbrellaTestContext } from "./_helper_umbrella";

const port = 1978;

describe("testing Client - Umbrella-I", function (this: Mocha.Context) {
    this.timeout(process.arch === "arm" ? 400_000 : 30_000);
    this.timeout(Math.max(30_000, this.timeout()));

    const test = this as UmbrellaTestContext;
    test.port = port;

    before(async () => beforeTest(test));
    beforeEach(async () => beforeEachTest(test));
    afterEach(async () => afterEachTest(test));
    after(async () => afterTest(test));

    require("./u_test_e2e_issue_445_currentSessionCount").t(test);
    require("./u_test_e2e_browse_read").t(test);
    require("./u_test_e2e_ctt_582022").t(test);
    require("./u_test_e2e_ctt_5.10.5_test3").t(test);
    require("./u_test_e2e_ctt_5.10.2_test7").t(test);
    require("./u_test_e2e_BrowseRequest").t(test);
    require("./u_test_e2e_security_username_password").t(test);
});

