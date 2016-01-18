require("requirish")._(module);

var should = require("should");
var assert = require("better-assert");
var async = require("async");
var util = require("util");
var _ = require("underscore");

var opcua = require("index");

var OPCUAClient = opcua.OPCUAClient;
var StatusCodes = opcua.StatusCodes;
var Variant = opcua.Variant;
var DataType = opcua.DataType;
var DataValue = opcua.DataValue;

var BrowseDirection = opcua.browse_service.BrowseDirection;
var debugLog = opcua.utils.make_debugLog(__filename);

// make sure extra error checking is made on object constructions
var schema_helpers = require("lib/misc/factories_schema_helpers");
schema_helpers.doDebug = true;

var port = 2000;

var build_server_with_temperature_device = require("test/helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;

var address_space_for_conformance_testing = require("lib/simulation/address_space_for_conformance_testing");
var build_address_space_for_conformance_testing = address_space_for_conformance_testing.build_address_space_for_conformance_testing;



describe("testing Client - Umbrella ", function () {

    // this test could be particularly slow on RapsberryPi or BeagleBoneBlack
    // so we set a big enough timeout
    // execution timecould also be affected by code running under profiling/coverage tools (istanbul)
    this.timeout((process.arch === 'arm') ? 400000 : 30000);
    this.timeout(Math.max(200000, this._timeout));

    var test = this;
    before(function (done) {

        console.log(" ..... starting server ".grey);
        resourceLeakDetector.start();
        test.server = build_server_with_temperature_device({port: port}, function (err) {

            build_address_space_for_conformance_testing(test.server.engine, {mass_variables: false});

            test.endpointUrl = test.server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            test.temperatureVariableId = test.server.temperatureVariableId;

            console.log(" ..... done ".grey);
            done(err);
        });

    });

    beforeEach(function (done) {
        done();
    });

    afterEach(function (done) {

        if (false) {
            console.log(" currentChannelCount          = ",test.server.currentChannelCount);
            console.log(" bytesWritten                 = ",test.server.bytesWritten);
            console.log(" bytesRead                    = ",test.server.bytesRead);
            console.log(" currentSubscriptionCount     = ",test.server.currentSubscriptionCount);
            console.log(" currentSessionCount          = ",test.server.currentSessionCount);
            console.log(" transactionsCount            = ",test.server.transactionsCount);
            console.log(" cumulatedSessionCount        = ",test.server.engine.cumulatedSessionCount);
            console.log(" cumulatedSubscriptionCount   = ",test.server.engine.cumulatedSubscriptionCount);
            console.log(" rejectedSessionCount         = ",test.server.engine.rejectedSessionCount);
        }

        test.server.currentSubscriptionCount.should.eql(0," verify test clean up : dangling  subscriptions found");
        test.server.currentSessionCount.should.eql(0," verify test clean up : dangling  session found");

        // test must not add exta nodes in root => "organizes" ref count => 3
        var addressSpace = test.server.engine.addressSpace;
        var rootFolder = addressSpace.findNode("RootFolder");
        rootFolder.getFolderElements().length.should.eql(3,"Test should not pollute the root folder: expecting 3 folders in RootFolder only");
        done();
    });

    after(function (done) {
        test.server.shutdown(function () {
            resourceLeakDetector.stop();
            done();
        });
    });

    require("./u_test_e2e_monitoring_large_number_of_nodes")(test);
    require("./u_test_e2e_BrowseRequest")(test);
    require("./u_test_e2e_security_username_password")(test);
    require("./u_test_e2e_SubscriptionUseCase")(test);
    require("./u_test_e2e_writeUseCase")(test);
    require("./u_test_e2e_transfer_session")(test);
    require("./u_test_e2e_registerNode")(test);
    require("./u_test_e2e_issue_73")(test);
    require("./u_test_e2e_issue_119")(test);
    require("./u_test_e2e_issue_141")(test);
    require("./u_test_e2e_issue_146")(test);
    require("./u_test_e2e_call_service")(test);
    require("./u_test_e2e_ClientSession_readVariableValue")(test);
    require("./u_test_e2e_read_write")(test);
    require("./u_test_e2e_client_node_crawler")(test);

    // OPCUA Event Monitoring test Cases
    require("./u_test_e2e_SubscriptionUseCase_monitoring_events")(test);
    //xx require("./u_test_e2e_SubscriptionUseCase_monitoring_events_2")(test);

    require("./u_test_e2e_issue_144")(test);
    require("./u_test_e2e_issue_156")(test);
    require("./u_test_e2e_issue_123")(test);

});

