/* eslint-disable max-statements */
import "should";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { beforeTest, afterTest, beforeEachTest, afterEachTest, UmbrellaTestContext } from "./_helper_umbrella";

const port = 1989;

describe("testing Client - Umbrella-G", function (this: Mocha.Context) {
  // Allow extended timeout for slower hardware / coverage scenarios
  this.timeout(process.arch === "arm" ? 400_000 : 30_000);
  this.timeout(Math.max(200_000, this.timeout()));

  const test = this as UmbrellaTestContext;
  test.port = port;

  before(async () => beforeTest(test));
  beforeEach(async () => beforeEachTest(test));
  afterEach(async () => afterEachTest(test));
  after(async () => afterTest(test));

  require("./u_test_e2e_1086").t(test);
  require("./u_test_e2e_issue1018_getMonitoredItems").t(test);
});

