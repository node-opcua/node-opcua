/* eslint-disable max-statements */
"use strict";
/* global: describe, require */
const should = require("should");


const port = 1995;

const { beforeTest, afterTest, beforeEachTest, afterEachTest } = require("./_helper_umbrella");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Client - Umbrella-F", function() {
  // this test could be particularly slow on RaspberryPi or BeagleBoneBlack
  // so we set a big enough timeout
  // execution time could also be affected by code running under profiling/coverage tools (istanbul)
  this.timeout(process.arch === "arm" ? 400000 : 30000);
  this.timeout(Math.max(200000, this.timeout()));

  const test = this;
  test.port = port;

  before((done) => beforeTest(test, done));
  beforeEach((done) => beforeEachTest(test, done));
  afterEach((done) => afterEachTest(test, done));
  after((done) => afterTest(test, done));
  // OPCUA Event Monitoring test Cases
  require("./u_test_e2e_SubscriptionUseCase_monitoring_events")(test);
  //xx require("./u_test_e2e_SubscriptionUseCase_monitoring_events_2")(test);

  require("./u_test_e2e_issue_144")(test);
  require("./u_test_e2e_issue_156")(test);
  require("./u_test_e2e_issue_123")(test);
  require("./u_test_e2e_issue_163")(test);
  require("./u_test_e2e_issue_135_currentMonitoredItemsCount")(test);
  require("./u_test_e2e_issue_192")(test);

  require("./u_test_e2e_issue_195")(test);
  require("./u_test_e2e_issue_198")(test);
  require("./u_test_e2e_issue_205_betterSessionNames")(test);
  require("./u_test_e2e_issue_214_StatusValueTimestamp")(test);
  require("./u_test_e2e_translateBrowsePath")(test);
  require("./u_test_e2e_server_with_500_clients")(test);
  require("./u_test_e2e_issue_73")(test);
  require("./u_test_e2e_issue_119")(test);
  require("./u_test_e2e_issue_141")(test);

  require("./u_test_e2e_issue_146")(test);
  require("./u_test_e2e_read_write")(test);
  require("./u_test_e2e_issue_957")(test);
 
  require("./u_test_e2e_monitored_item_ctt018").t(test);


  // require("./u_test_e2e_modifyMonitoredItem_onEvent")(test);

});
