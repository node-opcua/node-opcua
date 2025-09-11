/* eslint-disable max-statements */
import "should";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { beforeTest, afterTest, beforeEachTest, afterEachTest, UmbrellaTestContext } from "./_helper_umbrella";

const port = 1996;

describe("testing Client - Umbrella-E ", function (this: Mocha.Context) {
    // Allow generous timeout for slower boards or coverage instrumentation
    this.timeout(process.arch === "arm" ? 400000 : 30000);
    this.timeout(Math.max(200000, this.timeout()));

    const test = this as UmbrellaTestContext;
    test.port = port;

    before(async () => beforeTest(test));
    beforeEach(async () => beforeEachTest(test));
    afterEach(async () => afterEachTest(test));
    after(async () => afterTest(test));

    require("./u_test_e2e_SubscriptionUseCase").t(test);
});

