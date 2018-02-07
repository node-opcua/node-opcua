"use strict";


var should = require("should");
var async = require("async");


var perform_operation_on_raw_subscription = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_raw_subscription;

var opcua = require("node-opcua");
var OPCUAClient = opcua.OPCUAClient;
var DataValue = opcua.DataValue;
var DataType = opcua.DataType;
var Range = opcua.Range;

function getEURangeNodeId(session, nodeId, callback) {

    var euRangeNodeId = null;
    var browsePath = [
        opcua.makeBrowsePath(nodeId, ".EURange")
    ];
    session.translateBrowsePath(browsePath, function (err, results) {

        if (!err) {
            euRangeNodeId = results[0].targets[0].targetId;
            //xx console.log(" euRange nodeId =", euRangeNodeId.toString());
        }
        callback(err, euRangeNodeId);
    });
}


function writeIncrement(session, analogDataItem, done) {

    var value = null;
    async.series([

        function (callback) {
            var nodeToRead = {
                nodeId: analogDataItem,
                attributeId: opcua.AttributeIds.Value,
                indexRange: null,
                dataEncoding: null
            };
            session.read(nodeToRead, function (err, dataValue) {
                if (!err) {
                    value = dataValue.value.value;
                }
                callback(err)
            });
        },

        function (callback) {
            var nodeToWrite = {
                nodeId: analogDataItem,
                attributeId: opcua.AttributeIds.Value,
                value: new DataValue({
                    value: {dataType: DataType.Double, value: value + 1}
                })
            };
            session.write(nodeToWrite, function (err, statusCode) {
                statusCode.should.eql(opcua.StatusCodes.Good);
                callback(err);
            });
        }
    ], done)
}

function readEURange(session, nodeId, done) {
    var euRangeNodeId;
    var euRange;
    async.series([
        function (callback) {
            getEURangeNodeId(session, nodeId, function (err, result) {
                euRangeNodeId = result;
                callback(err);
            });
        },
        function (callback) {
            var nodesToRead = {
                nodeId: euRangeNodeId,
                attributeId: opcua.AttributeIds.Value,
                indexRange: null,
                dataEncoding: null
            };
            session.read(nodesToRead, function (err, dataValue) {
                if (!err) {
                    euRange = dataValue.value.value;
                    //xx console.log(" euRange =", euRange.toString());
                }
                callback(err, euRange)
            });
        }

    ], function (results) {
        done(null, euRange)
    });

}

function writeEURange(session, nodeId, euRange, done) {

    var euRangeNodeId;
    async.series([
        function (callback) {
            getEURangeNodeId(session, nodeId, function (err, result) {
                euRangeNodeId = result;
                callback(err);
            });
        },
        function (callback) {
            var nodeToWrite = {
                nodeId: euRangeNodeId,
                attributeId: opcua.AttributeIds.Value,
                value: new DataValue({
                    value: {dataType: DataType.ExtensionObject, value: new Range(euRange)}
                })
            };
            session.write(nodeToWrite, function (err,statusCode) {
                if (!err) {
                    statusCode.should.eql(opcua.StatusCodes.Good);
                }
                callback(err)
            });
        }

    ], done);

}


module.exports = function (test) {

    describe("Testing SemanticChanged Bit on statusCode monitoredItemData", function () {

        var client, endpointUrl;

        beforeEach(function (done) {
            client = new OPCUAClient();
            endpointUrl = test.endpointUrl;
            done();
        });

        afterEach(function (done) {
            client.disconnect(done);
            client = null;
        });


        function check_semantic_change(samplingInterval, done) {

            var analogDataItem = "ns=411;s=DoubleAnalogDataItem";


            perform_operation_on_raw_subscription(client, endpointUrl, function (session, subscription, callback) {

                var orgEURange = null;
                async.series([

                    // Read current Range
                    function (callback) {
                        readEURange(session, analogDataItem, function (err, euRange) {
                            if (!err) {
                                orgEURange = euRange;
                            }
                            callback(err);
                        });
                    },

                    // - create Monitored Item
                    function (callback) {

                        var itemToMonitor = new opcua.read_service.ReadValueId({
                            attributeId: opcua.AttributeIds.Value,
                            nodeId: analogDataItem
                        });
                        var monitoringMode = opcua.subscription_service.MonitoringMode.Reporting;

                        var monitoringParameters = new opcua.subscription_service.MonitoringParameters({
                            clientHandle: 1000,
                            samplingInterval: samplingInterval,
                            filter: null,
                            queueSize: 10,
                            discardOldest: true
                        });

                        var itemsToCreate = [{
                            itemToMonitor: itemToMonitor,
                            monitoringMode: monitoringMode,
                            requestedParameters: monitoringParameters
                        }];

                        var timestampsToReturn = opcua.read_service.TimestampsToReturn.Neither;

                        var createMonitorItemsRequest = new opcua.subscription_service.CreateMonitoredItemsRequest({
                            subscriptionId: subscription.subscriptionId,
                            timestampsToReturn: timestampsToReturn,
                            itemsToCreate: itemsToCreate
                        });

                        //Xx console.log(createMonitorItemsRequest.toString());
                        session.createMonitoredItems(createMonitorItemsRequest, function (err, response) {
                            //xx                            console.log("request=",createMonitorItemsRequest.toString());
                            //xx                            console.log("response = ",response.toString());
                            callback(err);
                        });

                    },

                    // now get initial request
                    function (callback) {
                        var publish_request = new opcua.subscription_service.PublishRequest({
                            requestHeader: {timeoutHint: 100000}, // see note
                            subscriptionAcknowledgements: []
                        });
                        session.publish(publish_request, function (err, publish_response) {
                            ///xx console.log(publish_response.toString());
                            // it should have the semantic changed bit set
                            var monitoredData = publish_response.notificationMessage.notificationData[0].monitoredItems[0];
                            monitoredData.value.statusCode.hasSemanticChangedBit.should.eql(false, "SemanticChange Bit shall not be set");
                            callback();
                        });
                    },

                    // Write modified range
                    function (callback) {
                        var newEURange = {low: orgEURange.low - 1, high: orgEURange.high + 1};
                        writeEURange(session, analogDataItem, newEURange, callback);
                    },

                    // now submit a publish request
                    function (callback) {
                        var publish_request = new opcua.subscription_service.PublishRequest({
                            requestHeader: {timeoutHint: 100000}, // see note
                            subscriptionAcknowledgements: []
                        });
                        session.publish(publish_request, function (err, publish_response) {
                            if (err) {
                                return callback(err);
                            }
                            //xx console.log(publish_response.toString());
                            // it should have the semantic changed bit set
                            var monitoredData = publish_response.notificationMessage.notificationData[0].monitoredItems[0];
                            monitoredData.value.statusCode.hasSemanticChangedBit.should.eql(true, "SemanticChange Bit shall be set");
                            callback();
                        });
                    },

                    // Write elements again to make sure we have a notification
                    function (callback) {
                        writeIncrement(session, analogDataItem, callback);
                    },

                    // now submit a publish request
                    function (callback) {
                        var publish_request = new opcua.subscription_service.PublishRequest({
                            requestHeader: {timeoutHint: 100000}, // see note
                            subscriptionAcknowledgements: []
                        });
                        session.publish(publish_request, function (err, publish_response) {
                            //xx console.log(publish_response.toString());
                            // it should have the semantic changed bit set
                            var monitoredData = publish_response.notificationMessage.notificationData[0].monitoredItems[0];
                            monitoredData.value.statusCode.hasSemanticChangedBit.should.eql(false, "SemanticChange Bit shall not be set");
                            callback();
                        });
                    },


                    // restore original range
                    function (callback) {
                        writeEURange(session, analogDataItem, orgEURange, callback);
                    }
                ], callback)

            }, done);
        }

        it("YY1 should set SemanticChanged - with sampling monitored item - 100 ms", function (done) {
            check_semantic_change(100, done);
        });

        it("YY2 should set SemanticChanged - with event based monitored item", function (done) {
            check_semantic_change(0, done);
        });

        it("YY3 should set SemanticChanged - with sampling monitored item - 1000 ms", function (done) {
            check_semantic_change(1000, done);
        });


    });

};
