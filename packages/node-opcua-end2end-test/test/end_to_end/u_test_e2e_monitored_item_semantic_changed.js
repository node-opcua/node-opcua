"use strict";
const should = require("should");
const async = require("async");
const chalk = require("chalk");

const {
    perform_operation_on_raw_subscription 
} = require("../../test_helpers/perform_operation_on_client_session");

const {
    ReadValueId,
    AttributeIds, MonitoringMode,MonitoringParameters,
    OPCUAClient,
    DataValue,
    DataType,
    Range,
    makeBrowsePath,
    StatusCodes,
    TimestampsToReturn,
    CreateMonitoredItemsRequest,
    PublishRequest
} = require("node-opcua");

const doDebug = false;

function getEURangeNodeId(session, nodeId, callback) {

    let euRangeNodeId = null;
    const browsePath = [
        makeBrowsePath(nodeId, ".EURange")
    ];
    session.translateBrowsePath(browsePath, (err, results) => {

        if (!err) {
            euRangeNodeId = results[0].targets[0].targetId;
            if (doDebug) {
                console.log(" euRange nodeId =", euRangeNodeId.toString());
            }
        }
        callback(err, euRangeNodeId);
    });
}


function writeIncrement(session, analogDataItem, done) {

    let value = null;
    async.series([

        function(callback) {
            const nodeToRead = {
                nodeId: analogDataItem,
                attributeId: AttributeIds.Value,
                indexRange: null,
                dataEncoding: null
            };
            session.read(nodeToRead, function(err, dataValue) {
                if (!err) {
                    value = dataValue.value.value;
                }
                callback(err)
            });
        },

        function(callback) {
            const nodeToWrite = {
                nodeId: analogDataItem,
                attributeId: AttributeIds.Value,
                value: new DataValue({
                    value: { dataType: DataType.Double, value: value + 1 }
                })
            };
            session.write(nodeToWrite, function(err, statusCode) {
                statusCode.should.eql(StatusCodes.Good);
                callback(err);
            });
        }
    ], done)
}

function readEURange(session, nodeId, done) {
    let euRangeNodeId;
    let euRange;
    async.series([
        function(callback) {
            getEURangeNodeId(session, nodeId, function(err, result) {
                euRangeNodeId = result;
                callback(err);
            });
        },
        function(callback) {
            const nodesToRead = {
                nodeId: euRangeNodeId,
                attributeId: AttributeIds.Value,
                indexRange: null,
                dataEncoding: null
            };
            session.read(nodesToRead, function(err, dataValue) {
                if (!err) {
                    euRange = dataValue.value.value;
                    //xx console.log(" euRange =", euRange.toString());
                }
                callback(err, euRange)
            });
        }

    ], function(results) {
        done(null, euRange)
    });

}

function writeEURange(session, nodeId, euRange, done) {

    let euRangeNodeId;
    async.series([
        function(callback) {
            getEURangeNodeId(session, nodeId, function(err, result) {
                euRangeNodeId = result;
                callback(err);
            });
        },
        function(callback) {
            const nodeToWrite = {
                nodeId: euRangeNodeId,
                attributeId: AttributeIds.Value,
                value: new DataValue({
                    value: { dataType: DataType.ExtensionObject, value: new Range(euRange) }
                })
            };
            session.write(nodeToWrite, function(err, statusCode) {
                if (!err) {
                    statusCode.should.eql(StatusCodes.Good);
                }
                callback(err)
            });
        },
        function(callback) {
            const nodeToRead = {
                nodeId: euRangeNodeId,
                attributeId: AttributeIds.Value,                
            };
            session.read(nodeToRead, (err, dataValue) => {
                // console.log("Verif = ", dataValue.value.value.toString(), euRange);
                callback();
            });
        }

    ], done);

}

function f(func) {
    return function(callback) {
        if (doDebug) {
            console.log("       * " + func.name.replace(/_/g, " ").replace(/(given|when|then)/, chalk.green("**$1**")));
        }
        return func(callback);
    };
}

function getNextDataChangeNotificiation(session, callback) {
    const publish_request = new PublishRequest({
        requestHeader: { timeoutHint: 100000 }, // see note
        subscriptionAcknowledgements: []
    });
    session.publish(publish_request, function(err, publish_response) {
        try {
            if (err) {
                return callback(err);
            }
            //xx console.log(publish_response.toString());
            const monitoredData = publish_response.notificationMessage.notificationData[0].monitoredItems[0];                    
            if (doDebug) {
                console.log(monitoredData.toString());
            }
            callback(null, monitoredData);

        } catch(err) {
            console.log(err);
            callback(err);
        }
    });
}
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

module.exports = function(test) {

    describe("Testing SemanticChanged Bit on statusCode monitoredItemData", function() {

        let client, endpointUrl;

        beforeEach(function(done) {
            client = OPCUAClient.create({});
            endpointUrl = test.endpointUrl;
            done();
        });

        afterEach(function(done) {
            client.disconnect(done);
            client = null;
        });


        function check_semantic_change(samplingInterval, done) {

            const analogDataItem = "ns=2;s=DoubleAnalogDataItem";

 
            perform_operation_on_raw_subscription(client, endpointUrl, (session, subscription, callback) => {

                let orgEURange = null;
                async.series([

                    // Read current Range
                    f(function read_current_range(callback) {
                        readEURange(session, analogDataItem, function(err, euRange) {
                            if (!err) {
                                orgEURange = euRange;
                            }
                            callback(err);
                        });
                    }),

                    
                    // - create Monitored Item
                    f(function create_monitored_item(callback) {

                        const itemToMonitor = new ReadValueId({
                            attributeId: AttributeIds.Value,
                            nodeId: analogDataItem
                        });
                        const monitoringMode = MonitoringMode.Reporting;

                        const monitoringParameters = new MonitoringParameters({
                            clientHandle: 1000,
                            samplingInterval,
                            filter: null,
                            queueSize: 100,
                            discardOldest: true
                        });

                        const itemsToCreate = [{
                            itemToMonitor,
                            monitoringMode,
                            requestedParameters: monitoringParameters
                        }];
                        const timestampsToReturn = TimestampsToReturn.Neither;

                        const createMonitorItemsRequest = new CreateMonitoredItemsRequest({
                            subscriptionId: subscription.subscriptionId,
                            timestampsToReturn,
                            itemsToCreate
                        });

                        //Xx console.log(createMonitorItemsRequest.toString());
                        session.createMonitoredItems(createMonitorItemsRequest, function(err, response) {
                            //xx                            console.log("request=",createMonitorItemsRequest.toString());
                            //xx                            console.log("response = ",response.toString());
                            callback(err);
                        });

                    }),

                    // now get initial request
                    f(function get_initial_data_change_notification(callback) {
                        getNextDataChangeNotificiation(session, (err,monitoredData ) => {
                            if(err) { return callback(err);}
                            monitoredData.value.statusCode.hasSemanticChangedBit.should.eql(false, "SemanticChange Bit shall not be set");
                            callback(err);
                        });
                    }),

                    // Write modified range
                    f(function write_modified_range(callback) {
                        const newEURange = { low: orgEURange.low - 1, high: orgEURange.high + 1 };
                        writeEURange(session, analogDataItem, newEURange, callback);
                    }),

                    // now submit a publish request
                    f(function get_data_change_notification(callback) {
                        getNextDataChangeNotificiation(session, (err,monitoredData ) => {
                            if(err) { return callback(err);}
                            // it should have the semantic changed bit set
                            monitoredData.value.statusCode.hasSemanticChangedBit.should.eql(true, "SemanticChange Bit shall be set");
                            callback();
                       });
                    }),

                    // Write elements again to make sure we have a notification
                    f(function change_variable_value(callback) {
                        writeIncrement(session, analogDataItem, callback);
                    }),

                    // now submit a publish request
                    f(function get_data_change_notification(callback) {
                        getNextDataChangeNotificiation(session, (err,monitoredData ) => {
                            if(err) { return callback(err);}
                            monitoredData.value.statusCode.hasSemanticChangedBit.should.eql(false, "SemanticChange Bit shall not be set");
                            callback();
                        });
                    }),


                    // restore original range
                    f(function restore_origin_range(callback) {
                        writeEURange(session, analogDataItem, orgEURange, callback);
                    })

                ], callback)

            }, done);
        }

        it("YY3 should set SemanticChanged - with sampling monitored item - 1000 ms", function(done) {
            check_semantic_change(1000, done);
        });
        it("YY1 should set SemanticChanged - with sampling monitored item - 100 ms", function(done) {
            check_semantic_change(100, done);
        });
        it("YY2 should set SemanticChanged - with event based monitored item", function(done) {
            check_semantic_change(0, done);
        });

    });
};
