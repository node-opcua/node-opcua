/*global describe, it, require*/
const async = require("async");
const should = require("should");
const opcua = require("node-opcua");
const OPCUAClient = opcua.OPCUAClient;

const perform_operation_on_subscription = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_subscription;

module.exports = function (test) {

    describe("Testing bug #445 - server.serverDiagnosticsSummary.currentSessionCount", function () {

        it("test that current SessionCount increments and decrements appropriately", function (done) {

            const endpointUrl = test.endpointUrl;

            const client = new opcua.OPCUAClient({});

            const currentSessionCountNodeId = opcua.resolveNodeId(opcua.VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSessionCount);
            const cumulatedSessionCountNodeId = opcua.resolveNodeId((opcua.VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CumulatedSessionCount));

            perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {

                const currentSessionCountMonitoredItem = subscription.monitor(
                    {nodeId: currentSessionCountNodeId, attributeId: opcua.AttributeIds.Value},
                    {
                        samplingInterval: 0, // reports immediately
                        discardOldest: true,
                        queueSize: 10
                    });

                const cumulatedSessionCountMonitoredItem = subscription.monitor(
                    {nodeId: cumulatedSessionCountNodeId, attributeId: opcua.AttributeIds.Value},
                    {
                        samplingInterval: 0, // reports immediately
                        discardOldest: true,
                        queueSize: 10
                    });

                const recordedCumulatedSessionCountValues = [];
                cumulatedSessionCountMonitoredItem.on("changed",function(dataValue){
                    recordedCumulatedSessionCountValues.push(dataValue.value.value);
                });
                const recordedCurrentSessionCountValues = [];
                currentSessionCountMonitoredItem.on("changed", function (dataValue) {
                    recordedCurrentSessionCountValues.push(dataValue.value.value);
                });


                let currentSessionCount = 0;
                currentSessionCountMonitoredItem.once("changed", function (dataValue) {
                    dataValue.statusCode.should.eql(opcua.StatusCodes.Good);
                    currentSessionCount = dataValue.value.value;
                    //xx console.log("!!!! new_currentSessionCount=",dataValue.toString());
                });




                currentSessionCountMonitoredItem.once("changed", function () {

                    setImmediate(function () {

                        let data1, data2;
                        function connect_and_create_session(callback) {
                            const client = new OPCUAClient({});
                            client.connect(endpointUrl, function (err) {
                                if (err) {
                                    return callback(err);
                                }
                                client.createSession(function (err, session) {
                                    if (err) {
                                        return callback(err);
                                    }
                                    callback(err, {client, session})
                                })
                            });

                        }

                        function close_session_and_disconnect(data, callback) {

                            const session = data.session;
                            const client = data.client;
                            session.close(function () {
                                client.disconnect(callback);
                            });

                        }

                        async.series([
                            function (callback) {
                                currentSessionCountMonitoredItem.once("changed", function (dataValue) {
                                    const new_currentSessionCount = dataValue.value.value;
                                    new_currentSessionCount.should.eql(currentSessionCount + 1);
                                    //xx console.log("new_currentSessionCount=",dataValue.toString());
                                    callback();
                                });
                                connect_and_create_session(function (err, data) {
                                    data1 = data;
                                });
                            },
                            function (callback) {
                                currentSessionCountMonitoredItem.once("changed", function (dataValue) {
                                    const new_currentSessionCount = dataValue.value.value;
                                    new_currentSessionCount.should.eql(currentSessionCount + 2);
                                    //xx console.log("new_currentSessionCount=",dataValue.toString());
                                    callback();
                                });
                                connect_and_create_session(function (err, data) {
                                    data2 = data;
                                });
                            },
                            function (callback) {
                                currentSessionCountMonitoredItem.once("changed", function (dataValue) {
                                    const new_currentSessionCount = dataValue.value.value;
                                    new_currentSessionCount.should.eql(currentSessionCount + 1);
                                    //xx console.log("new_currentSessionCount=",dataValue.toString());
                                    callback();
                                });
                                close_session_and_disconnect(data2, function () {
                                });
                            },
                            function (callback) {
                                currentSessionCountMonitoredItem.once("changed", function (dataValue) {
                                    const new_currentSessionCount = dataValue.value.value;
                                    new_currentSessionCount.should.eql(currentSessionCount);

                                    const cc = recordedCumulatedSessionCountValues[0];
                                    recordedCumulatedSessionCountValues.should.eql([cc,cc+1,cc+2]);

                                    const c = currentSessionCount-1;
                                    recordedCurrentSessionCountValues.should.eql([c+1,c+2,c+3,c+2,c+1]);

                                    callback();
                                });
                                close_session_and_disconnect(data1, function () {

                                });
                            }
                        ], callback);
                    });

                });

            }, done);
        });
    });
};


