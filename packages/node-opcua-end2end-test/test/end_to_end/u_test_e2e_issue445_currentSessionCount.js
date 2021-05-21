/*global describe, it, require*/
const async = require("async");
const should = require("should");
const opcua = require("node-opcua");
const OPCUAClient = opcua.OPCUAClient;
const chalk = require("chalk");


function f(func) {
    return function(callback) {
        console.log("       * " + func.name.replace(/_/g, " ").replace(/(given|when|then)/, chalk.green("**$1**")));
        return func(callback);
    };
}

const {
    make_debugLog,
    make_errorLog,
    checkDebugFlag
} = require("node-opcua-debug");

const debugLog = make_debugLog("TEST");
const errorLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const { perform_operation_on_subscription } = require("../../test_helpers/perform_operation_on_client_session");

module.exports = function(test) {

    describe("Testing bug #445 - server.serverDiagnosticsSummary.currentSessionCount", function() {

        it("test that current SessionCount increments and decrements appropriately", function(done) {

            const endpointUrl = test.endpointUrl;

            const client = opcua.OPCUAClient.create({});

            const currentSessionCountNodeId = opcua.resolveNodeId(opcua.VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSessionCount);
            const cumulatedSessionCountNodeId = opcua.resolveNodeId((opcua.VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CumulatedSessionCount));

            perform_operation_on_subscription(client, test.endpointUrl, function(session, subscription, callback) {

                debugLog(subscription.toString());

                const currentSessionCountMonitoredItem = opcua.ClientMonitoredItem.create(
                    subscription,
                    { nodeId: currentSessionCountNodeId, attributeId: opcua.AttributeIds.Value },
                    {
                        samplingInterval: 0, // reports immediately
                        discardOldest: true,
                        queueSize: 10
                    });

                const cumulatedSessionCountMonitoredItem = opcua.ClientMonitoredItem.create(
                    subscription,
                    { nodeId: cumulatedSessionCountNodeId, attributeId: opcua.AttributeIds.Value },
                    {
                        samplingInterval: 0, // reports immediately
                        discardOldest: true,
                        queueSize: 10
                    });

                const recordedCumulatedSessionCountValues = [];
                cumulatedSessionCountMonitoredItem.on("changed", function(dataValue) {
                    recordedCumulatedSessionCountValues.push(dataValue.value.value);
                    debugLog("cumulatedSessionCount =", recordedCumulatedSessionCountValues);
                });
                const recordedCurrentSessionCountValues = [];
                currentSessionCountMonitoredItem.on("changed", function(dataValue) {
                    recordedCurrentSessionCountValues.push(dataValue.value.value);
                    debugLog("currentSessionCount =", recordedCurrentSessionCountValues);
                });


                let currentSessionCount = 0;
                currentSessionCountMonitoredItem.once("changed", function(dataValue) {
                    dataValue.statusCode.should.eql(opcua.StatusCodes.Good);
                    currentSessionCount = dataValue.value.value;
                    //xx console.log("!!!! new_currentSessionCount=",dataValue.toString());
                });

                currentSessionCountMonitoredItem.once("changed", function() {

                    setImmediate(function() {

                        let data1, data2;

                        function connect_and_create_session(callback) {
                            const client = OPCUAClient.create({});
                            client.connect(endpointUrl, function(err) {
                                if (err) {
                                    return callback(err);
                                }
                                client.createSession(function(err, session) {
                                    if (err) {
                                        return callback(err);
                                    }
                                    callback(err, { client, session });
                                });
                            });

                        }

                        function close_session_and_disconnect(data, callback) {

                            if (!data) {
                                errorLog("Error : close_session_and_disconnect is called too early , data is not ready");
                                return callback();
                            }
                            const session = data.session;
                            const client = data.client;

                            session.close(function() {
                                setImmediate(() => {
                                    client.disconnect(callback);
                                });
                            });

                        }

                        async.series([
                            f(function connect_client1(callback) {
                                currentSessionCountMonitoredItem.once("changed", function(dataValue) {
                                    const new_currentSessionCount = dataValue.value.value;
                                    new_currentSessionCount.should.eql(currentSessionCount + 1);
                                    debugLog("new_currentSessionCount=", dataValue.toString());
                                    callback();
                                });
                                connect_and_create_session(function(err, data) {
                                    if (err) {
                                        debugLog("ERR => ", err);
                                    }
                                    data1 = data;
                                });
                            }),
                            f(function connect_client2(callback) {
                                currentSessionCountMonitoredItem.once("changed", function(dataValue) {
                                    const new_currentSessionCount = dataValue.value.value;
                                    new_currentSessionCount.should.eql(currentSessionCount + 2);
                                    debugLog("new_currentSessionCount=", dataValue.toString());
                                    if (!data2) {
                                        errorLog("Event has been received before session creation has been notified," +
                                            "this could happen !!!");
                                    }
                                    setImmediate(callback);
                                });
                                connect_and_create_session(function(err, data) {
                                    if (err) {
                                        debugLog("ERR => ", err);
                                    }
                                    data2 = data;
                                });
                            }),
                            f(function disconnect_client2(callback) {

                                currentSessionCountMonitoredItem.once("changed", function(dataValue) {
                                    const new_currentSessionCount = dataValue.value.value;
                                    new_currentSessionCount.should.eql(currentSessionCount + 1);
                                    debugLog("new_currentSessionCount=", dataValue.toString());
                                    setImmediate(callback);
                                });
                                close_session_and_disconnect(data2, function() {
                                });
                            }),

                            f(function disconnect_client1(callback) {
                                currentSessionCountMonitoredItem.once("changed", function(dataValue) {
                                    const new_currentSessionCount = dataValue.value.value;
                                    new_currentSessionCount.should.eql(currentSessionCount);
                                    debugLog("new_currentSessionCount=", dataValue.toString());
                                    callback();
                                });
                                close_session_and_disconnect(data1, function() {

                                });
                            }),
                            f(function verify(callback) {
                                const cc = recordedCumulatedSessionCountValues[0];
                                recordedCumulatedSessionCountValues.should.eql([cc, cc + 1, cc + 2]);

                                const c = currentSessionCount - 1;
                                recordedCurrentSessionCountValues.should.eql([c + 1, c + 2, c + 3, c + 2, c + 1]);
                                callback();
                            })
                        ], callback);
                    });

                });

            }, done);
        });
    });
};


