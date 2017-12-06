    "use strict";
/* global describe,it,before,after,beforeEach,afterEach*/


var async = require("async");
var should = require("should");

var opcua        = require("node-opcua");
var makeNodeId   = opcua.makeNodeId;
var DataType     = opcua.DataType;
var AttributeIds = opcua.AttributeIds;
var OPCUAClient  = opcua.OPCUAClient;

var perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;

module.exports = function (test) {

    var client;
    describe("end-to-end testing of a write operation between a client and a server (session#write)", function () {

        beforeEach(function (done) {
            client = new OPCUAClient();
            done();
        });
        afterEach(function (done) {
            client = null;
            done();
        });

        it("should return BadNodeIdUnknown if nodeId is unknown ", function (done) {

            perform_operation_on_client_session(client, test.endpointUrl, function (session, done) {

                var unknown_nodeid = makeNodeId(7777, 8788);
                var nodesToWrite = [
                    {
                        nodeId: unknown_nodeid,
                        attributeId: AttributeIds.Value,
                        value: /*new DataValue(*/{
                            value: {/* Variant */dataType: DataType.Double, value: 10.0}
                        }
                    }
                ];

                session.write(nodesToWrite, function (err, statusCodes) {
                    if (!err) {
                        statusCodes.length.should.equal(nodesToWrite.length);
                        statusCodes[0].should.eql(opcua.StatusCodes.BadNodeIdUnknown);
                    }
                    done(err);
                });

            }, done);
        });

        it("should return Good if nodeId is known but not writeable ", function (done) {

            perform_operation_on_client_session(client, test.endpointUrl, function (session, done) {

                var pumpSpeedId = "ns=4;b=0102030405060708090a0b0c0d0e0f10";

                var nodesToWrite = [
                    {
                        nodeId: pumpSpeedId,
                        attributeId: AttributeIds.Value,
                        value: /*new DataValue(*/{
                            value: {/* Variant */dataType: DataType.Double, value: 10.0}
                        }
                    }
                ];

                session.write(nodesToWrite, function (err, statusCodes) {
                    if (!err) {
                        statusCodes.length.should.equal(nodesToWrite.length);
                        statusCodes[0].should.eql(opcua.StatusCodes.BadNotWritable);
                    }
                    done(err);
                });

            }, done);

        });

        it("should return Good if nodeId is known and writable ", function (done) {

            perform_operation_on_client_session(client, test.endpointUrl, function (session, done) {

                var setPointTemperatureId = "ns=4;s=SetPointTemperature";

                var nodesToWrite = [
                    {
                        nodeId: setPointTemperatureId,
                        attributeId: AttributeIds.Value,
                        value: /*new DataValue(*/{
                            value: {/* Variant */dataType: DataType.Double, value: 10.0}
                        }
                    }
                ];

                session.write(nodesToWrite, function (err, statusCodes) {
                    if (!err) {
                        statusCodes.length.should.equal(nodesToWrite.length);
                        statusCodes[0].should.eql(opcua.StatusCodes.Good);
                    }
                    done(err);
                });

            }, done);
        });


        it("should return an error if value to write has a wrong dataType", function (done) {

            perform_operation_on_client_session(client, test.endpointUrl, function (session, done) {

                var setPointTemperatureId = "ns=4;s=SetPointTemperature";

                var nodesToWrite = [
                    {
                        nodeId: setPointTemperatureId,
                        attributeId: AttributeIds.Value,
                        value: /*new DataValue(*/{
                            value: {
                                /* Variant */
                                dataType: DataType.String,
                                value: "This is a string, but should be a Float"
                            }
                        }
                    }
                ];

                session.write(nodesToWrite, function (err, statusCodes) {
                    if (!err) {
                        statusCodes.length.should.equal(nodesToWrite.length);
                        statusCodes[0].should.eql(opcua.StatusCodes.BadTypeMismatch);
                    }
                    done(err);
                });

            }, done);

        });

        it("should return an error if value to write has a wrong dataType ( Double  instead of Float)", function (done) {

            perform_operation_on_client_session(client, test.endpointUrl, function (session, done) {

                var float_Node = "ns=411;s=Scalar_Simulation_Float";

                var nodesToWrite = [
                    {
                        nodeId: float_Node,
                        attributeId: AttributeIds.Value,
                        value: /*new DataValue(*/{
                            value: {/* Variant */dataType: DataType.Double, value: 2}
                        }
                    }
                ];

                session.write(nodesToWrite, function (err, statusCodes) {
                    if (!err) {
                        statusCodes.length.should.equal(nodesToWrite.length);
                        statusCodes[0].should.eql(opcua.StatusCodes.BadTypeMismatch);
                    }
                    done(err);
                });

            }, done);

        });

        it("server should return Good_CompletesAsynchronously if the  variable write operation happens asynchronously", function (done) {

            // The value was successfully written to an intermediate system but the Server does not know if
            // the data source was updated properly.


            perform_operation_on_client_session(client, test.endpointUrl, function (session, done) {

                var asyncNodeId = "ns=4;s=AsynchronousVariable";

                var nodesToWrite = [
                    {
                        nodeId: asyncNodeId,
                        attributeId: AttributeIds.Value,
                        value: /*new DataValue(*/{
                            value: {/* Variant */dataType: DataType.Double, value: 23.0}
                        }
                    }
                ];

                session.write(nodesToWrite, function (err, statusCodes) {
                    if (!err) {
                        //xx console.log(statusCodes);
                        statusCodes.length.should.equal(nodesToWrite.length);
                        statusCodes[0].should.eql(opcua.StatusCodes.GoodCompletesAsynchronously);
                    }
                    done(err);
                });
            }, done);
        });

        it("should return BadNothingToDo if writeRequest is empty", function (done) {
            perform_operation_on_client_session(client, test.endpointUrl, function (session, done) {

                var nodesToWrite = [];

                session.write(nodesToWrite, function (err, statusCodes) {
                    err.message.should.match(/BadNothingToDo/);
                    done();
                });

            }, done);
        });


        it("should return BadNothingToDo if writeRequest is null", function (done) {
            perform_operation_on_client_session(client, test.endpointUrl, function (session, done) {

                var request = new opcua.write_service.WriteRequest({nodesToWrite: []});
                request.nodesToWrite = null;
                session.performMessageTransaction(request, function (err, response) {
                    err.message.should.match(/BadNothingToDo/);
                    done();
                });

            }, done);
        });

        it("MMM should return BadTooManyOperation if nodesToWrite has too many elements",function(done){

            test.server.engine.serverCapabilities.operationLimits.maxNodesPerWrite = 3;

            test.server.engine.serverCapabilities.operationLimits.maxNodesPerWrite.should.be.greaterThan(1);

            perform_operation_on_client_session(client, test.endpointUrl, function (session, done) {

                var nodeToWrite  = {
                    nodeId: null,
                    attributeId: AttributeIds.Value,
                    value: /*new DataValue(*/{
                        value: {/* Variant */dataType: DataType.Double, value: 23.0}
                    }
                };
                var nodesToWrite = [
                    nodeToWrite,
                    nodeToWrite,
                    nodeToWrite,
                    nodeToWrite,
                    nodeToWrite,
                    nodeToWrite,
                    nodeToWrite,
                    nodeToWrite,
                    nodeToWrite,
                    nodeToWrite,
                    nodeToWrite,
                    nodeToWrite,

                ];



                var request = new opcua.write_service.WriteRequest({nodesToWrite: nodesToWrite});
                session.performMessageTransaction(request, function (err, response) {
                    err.message.should.match(/BadTooManyOperations/);

                    // restore limit to zero
                    test.server.engine.serverCapabilities.operationLimits.maxNodesPerWrite = 0;
                    done();
                });

            }, done);


        });

        it("VQT should write Value Quality Timestamp - on basic variable", function (done) {

            var setPointTemperatureId = "ns=4;s=SetPointTemperature";
            // Value, Quality, sourceTimestamp
            perform_operation_on_client_session(client, test.endpointUrl, function (session, done) {

                var date = new Date();
                date.setTime(date.getTime() + 3);

                var nodesToWrite = [{
                    nodeId: setPointTemperatureId,
                    attributeId: AttributeIds.Value,
                    value: new opcua.DataValue({
                        value: {
                            /* Variant */dataType: DataType.Double, value: -23.0
                        },
                        sourceTimestamp: date,
                        sourcePicoseconds: 112,
                        statusCode: opcua.StatusCodes.GoodLocalOverride
                    })
                }];

                //xx console.log(" requested source timestamp =", date.getTime());

                session.write(nodesToWrite, function (err, statusCodes) {
                    if (err) {
                        return done(err);
                    }
                    //xx console.log(statusCodes);
                    statusCodes.length.should.equal(nodesToWrite.length);
                    statusCodes[0].should.eql(opcua.StatusCodes.Good);

                    var nodesToRead = [{
                        nodeId: setPointTemperatureId,
                        attributeId: AttributeIds.Value
                    }];
                    session.read(nodesToRead, function (err, r, results) {
                        if (err) {
                            return done(err);
                        }
                        //xx console.log("====", results[0].sourceTimestamp.getTime());
                        //xx console.log(results[0].toString());
                        results[0].sourceTimestamp.getTime().should.eql(date.getTime());
                        results[0].sourcePicoseconds.should.eql(112);
                        results[0].statusCode.should.eql(opcua.StatusCodes.GoodLocalOverride);
                        done();
                    });
                });
            }, done);

        });

        it("VQT should write Value Quality Timestamp - on async variable that support fullblow dataValue write", function (done) {

            var asyncNodeId = "ns=4;s=AsynchronousFullVariable";

            // Value, Quality, sourceTimestamp
            perform_operation_on_client_session(client, test.endpointUrl, function (session, done) {


                var date = new Date();
                date.setTime(date.getTime() + 3);

                var nodesToWrite = [{
                    nodeId: asyncNodeId,
                    attributeId: AttributeIds.Value,
                    value: new opcua.DataValue({
                        value: {
                            /* Variant */dataType: DataType.Double, value: -23.0
                        },
                        sourceTimestamp: date,
                        sourcePicoseconds: 112,
                        statusCode: opcua.StatusCodes.UncertainSensorNotAccurate
                    })
                }];

                //xx console.log(" requested source timestamp =", date.getTime());

                session.write(nodesToWrite, function (err, statusCodes) {
                    if (err) {
                        return done(err);
                    }
                    statusCodes.length.should.equal(nodesToWrite.length);
                    statusCodes[0].should.eql(opcua.StatusCodes.Good);

                    var nodesToRead = [{
                        nodeId: asyncNodeId,
                        attributeId: AttributeIds.Value
                    }];

                    session.read(nodesToRead, function (err, r, results) {

                        if (err) {
                            return done(err);
                        }
                        //xx console.log(" server    source timestamp =",results[0].sourceTimestamp.getTime());
                        //xx console.log(results[0].toString());
                        results[0].sourceTimestamp.getTime().should.eql(date.getTime());
                        results[0].sourcePicoseconds.should.eql(112);
                        results[0].statusCode.should.eql(opcua.StatusCodes.UncertainSensorNotAccurate);
                        done();
                    });
                });
            }, done);

        });
    });
};
