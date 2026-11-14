import "should";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { afterEachTest, afterTest, beforeEachTest, beforeTest } from "./_helper_umbrella.js";
import { t as tE2eSubscriptionUseCase } from "./u_test_e2e_SubscriptionUseCase.js";
const port = 1996;
describe("testing Client - Umbrella-E ", function () {
    // Allow generous timeout for slower boards or coverage instrumentation
    this.timeout(process.arch === "arm" ? 400000 : 30000);
    this.timeout(Math.max(200000, this.timeout()));
    const test = this;
    test.port = port;
    before(async () => beforeTest(test));
    beforeEach(async () => beforeEachTest(test));
    afterEach(async () => afterEachTest(test));
    after(async () => afterTest(test));
    tE2eSubscriptionUseCase(test);
});
//# sourceMappingURL=test_umbrella_e2e_seriesE.js.map