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

var port = 2000;

var build_server_with_temperature_device = require("test/helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;

var address_space_for_conformance_testing = require("lib/simulation/address_space_for_conformance_testing");
var build_address_space_for_conformance_testing = address_space_for_conformance_testing.build_address_space_for_conformance_testing;


var start_simple_server = require("test/helpers/external_server_fixture").start_simple_server;
var stop_simple_server = require("test/helpers/external_server_fixture").stop_simple_server;


describe("testing Client - Umbrella ", function () {

    // this test could be particularly slow on RaspberryPi or BeagleBoneBlack
    // so we set a big enough timeout
    // execution time could also be affected by code running under profiling/coverage tools (istanbul)
    this.timeout((process.arch === 'arm') ? 400000 : 30000);
    this.timeout(Math.max(200000, this._timeout));

    var test = this;
    test.nb_backgroundsession = 0;

    var options = {
        port: port,
        maxConnectionsPerEndpoint: 500,
        silent: true
    };

    function start_external_server(done) {
        start_simple_server(options, function (err, data) {

            if (err) {
                return done(err, null);
            }

            test.endpointUrl = data.endpointUrl;
            test.serverCertificate = data.serverCertificate;
            test.temperatureVariableId = data.temperatureVariableId;
            test.data;
            console.log(" test.endpointUrl  = ".yellow, test.endpointUrl.cyan);
            done();
        });
    }

    function start_internal_server(done) {

        test.server = build_server_with_temperature_device(options, function (err) {

            build_address_space_for_conformance_testing(test.server.engine, {mass_variables: false});

            test.endpointUrl = test.server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            test.temperatureVariableId = test.server.temperatureVariableId;

            console.log(" ..... done ".grey);
            done(err);
        });
    }

    before(function (done) {

        console.log(" ..... starting server ".grey);
        resourceLeakDetector.start();
        if (process.env.TESTENDPOINT === "EXTERNAL") {
            start_external_server(done);
        } else if (process.env.TESTENDPOINT) {
            test.endpointUrl = process.env.TESTENDPOINT;
            done();
        } else {
            start_internal_server(done);
        }

    });

    beforeEach(function (done) {
        // make sure that test has closed all sessions
        test.nb_backgroundsession = test.server.engine.currentSessionCount;
        done();
    });

    function dumpStatistics(endpointUrl, done) {
        var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;

        var client = new OPCUAClient();
        var endpointUrl = test.endpointUrl;

        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
            var relativePath = "/Objects/Server.ServerDiagnostics.ServerDiagnosticsSummary";
            var browsePath = [
                opcua.browse_service.makeBrowsePath("RootFolder", relativePath),
            ];

            var sessionDiagnosticsSummaryNodeId;
            async.series([

                function (callback) {
                    session.translateBrowsePath(browsePath, function (err, result) {
                        if (!err) {
                            if (result[0].statusCode === StatusCodes.Good) {
                                //xx console.log(result[0].toString());
                                sessionDiagnosticsSummaryNodeId = result[0].targets[0].targetId;
                            } else {
                                err = new Error("Cannot find ServerDiagnosticsSummary")
                            }
                        }
                        callback(err);
                    });
                },
                function (callback) {

                    session.readVariableValue(sessionDiagnosticsSummaryNodeId, function (err, dataValue) {
                        console.log("\n\n-----------------------------------------------------------------------------------------------------------");
                        console.log(dataValue.value.value.toString());
                        console.log("-----------------------------------------------------------------------------------------------------------");
                        callback(err);
                    });
                }
            ], inner_done);

        }, done);
    }

    afterEach(function (done) {

        // make sure that test has closed all sessions
        test.server.engine.currentSessionCount.should.eql(test.nb_backgroundsession);

        if (true) {
            return done();
        }

        if (false && test.server) {
            console.log(" currentChannelCount          = ", test.server.currentChannelCount);
            console.log(" bytesWritten                 = ", test.server.bytesWritten);
            console.log(" bytesRead                    = ", test.server.bytesRead);
            console.log(" currentSubscriptionCount     = ", test.server.currentSubscriptionCount);
            console.log(" currentSessionCount          = ", test.server.currentSessionCount);
            console.log(" transactionsCount            = ", test.server.transactionsCount);
            console.log(" cumulatedSessionCount        = ", test.server.engine.cumulatedSessionCount);
            console.log(" cumulatedSubscriptionCount   = ", test.server.engine.cumulatedSubscriptionCount);
            console.log(" rejectedSessionCount         = ", test.server.engine.rejectedSessionCount);

            test.server.currentSubscriptionCount.should.eql(0, " verify test clean up : dangling  subscriptions found");
            test.server.currentSessionCount.should.eql(0, " verify test clean up : dangling  session found");
            // test must not add exta nodes in root => "organizes" ref count => 3
            var addressSpace = test.server.engine.addressSpace;
            var rootFolder = addressSpace.findNode("RootFolder");
            rootFolder.getFolderElements().length.should.eql(3, "Test should not pollute the root folder: expecting 3 folders in RootFolder only");
        }

        dumpStatistics(test.endpointUrl, done);

    });

    after(function (done) {
        if (test.data) {
            stop_simple_server(data, done);
        } else if (test.server) {
            test.server.shutdown(function () {
                console.log("resourceLeakDetector.stop()");
                resourceLeakDetector.stop();
                done();
            });
        } else {
            done();
        }
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
    require("./u_test_e2e_issue_163")(test);
    require("./u_test_e2e_issue_135_currentMonitoredItemsCount")(test);
    require("./u_test_e2e_issue_192")(test);

    require("./u_test_e2e_issue_195")(test);
    require("./u_test_e2e_issue_198")(test);
    require("./u_test_e2e_issue_205_betterSessionNames")(test);
    require("./u_test_e2e_issue_214_StatusValueTimestamp")(test);
    require("./u_test_e2e_translateBrowsePath")(test);
    require("./u_test_e2e_server_with_500_clients")(test);
    require("./u_test_e2e_server_connection_with_500_sessions")(test);
    require("./u_test_e2e_SubscriptionDiagnostics")(test);
    require("./u_test_e2e_browse_request_issue")(test);
    require("./u_test_e2e_timeout_session")(test);
    require("./u_test_e2e_session_audit_events")(test);
    require("./u_test_e2e_closing_unactivated_session")(test);
    require("./u_test_e2e_issue_223_demonstrate_client_call_service")(test);
    require("./u_test_e2e_Subscription_Transfer")(test);
    require("./u_test_e2e_issue_231_protocolVersion")(test);
    require("./u_test_e2e_monitored_item_semantic_changed")(test);
    require("./u_test_e2e_issue_233")(test);
});

