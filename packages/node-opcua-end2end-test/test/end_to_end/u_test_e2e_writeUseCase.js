    "use strict";
/* global describe,it,before,after,beforeEach,afterEach*/


const async = require("async");
const should = require("should");

const opcua        = require("node-opcua");
const makeNodeId   = opcua.makeNodeId;
const DataType     = opcua.DataType;
const AttributeIds = opcua.AttributeIds;
const OPCUAClient  = opcua.OPCUAClient;

const perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;

module.exports = function (test) {

    let client;
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

                const unknown_nodeid = makeNodeId(7777, 8788);
                const nodesToWrite = [
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

                const pumpSpeedId = "ns=4;b=0102030405060708090a0b0c0d0e0f10";

                const nodesToWrite = [
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

                const setPointTemperatureId = "ns=4;s=SetPointTemperature";

                const nodesToWrite = [
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

                const setPointTemperatureId = "ns=4;s=SetPointTemperature";

                const nodesToWrite = [
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

                const float_Node = "ns=411;s=Scalar_Simulation_Float";

                const nodesToWrite = [
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

                const asyncNodeId = "ns=4;s=AsynchronousVariable";

                const nodesToWrite = [
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

                const nodesToWrite = [];

                session.write(nodesToWrite, function (err, statusCodes) {
                    err.message.should.match(/BadNothingToDo/);
                    done();
                });

            }, done);
        });


        it("should return BadNothingToDo if writeRequest is null", function (done) {
            perform_operation_on_client_session(client, test.endpointUrl, function (session, done) {

                const request = new opcua.write_service.WriteRequest({nodesToWrite: []});
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

                const nodeToWrite  = {
                    nodeId: null,
                    attributeId: AttributeIds.Value,
                    value: /*new DataValue(*/{
                        value: {/* Variant */dataType: DataType.Double, value: 23.0}
                    }
                };
                const nodesToWrite = [
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



                const request = new opcua.write_service.WriteRequest({nodesToWrite: nodesToWrite});
                session.performMessageTransaction(request, function (err, response) {
                    err.message.should.match(/BadTooManyOperations/);

                    // restore limit to zero
                    test.server.engine.serverCapabilities.operationLimits.maxNodesPerWrite = 0;
                    done();
                });

            }, done);


        });

        it("VQT should write Value Quality Timestamp - on basic variable", function (done) {

            const setPointTemperatureId = "ns=4;s=SetPointTemperature";
            // Value, Quality, sourceTimestamp
            perform_operation_on_client_session(client, test.endpointUrl, function (session, done) {

                const date = new Date();
                date.setTime(date.getTime() + 3);

                const nodesToWrite = [{
                    nodeId: setPointTemperatureId,
                    attributeId: AttributeIds.Value,
                    value: new opcua.DataValue({
                        value: {
                            /* Variant */dataType: DataType.Double, value: -23.0
                        },
                        sourceTimestamp: date,
                        sourcePicoseconds: 1120,
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

                    const nodesToRead = {
                        nodeId: setPointTemperatureId,
                        attributeId: AttributeIds.Value
                    };
                    session.read(nodesToRead, function (err, dataValue) {
                        if (err) {
                            return done(err);
                        }
                        //xx console.log("====", results[0].sourceTimestamp.getTime());
                        //xx console.log(results[0].toString());
                        dataValue.sourceTimestamp.getTime().should.eql(date.getTime());
                        dataValue.sourcePicoseconds.should.eql(1120);
                        dataValue.statusCode.should.eql(opcua.StatusCodes.GoodLocalOverride);
                        done();
                    });
                });
            }, done);

        });

        it("VQT should write Value Quality Timestamp - on async variable that support full blown dataValue write", function (done) {

            const asyncNodeId = "ns=4;s=AsynchronousFullVariable";

            // Value, Quality, sourceTimestamp
            perform_operation_on_client_session(client, test.endpointUrl, function (session, done) {


                const date = new Date();
                date.setTime(date.getTime() + 3);

                const nodesToWrite = [{
                    nodeId: asyncNodeId,
                    attributeId: AttributeIds.Value,
                    value: new opcua.DataValue({
                        value: {
                            /* Variant */dataType: DataType.Double, value: -23.0
                        },
                        sourceTimestamp: date,
                        sourcePicoseconds: 1120,
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

                    const nodeToRead = {
                        nodeId: asyncNodeId,
                        attributeId: AttributeIds.Value
                    };

                    session.read(nodeToRead, function (err, dataValue) {

                        if (err) {
                            return done(err);
                        }
                        //xx console.log(" server    source timestamp =",results[0].sourceTimestamp.getTime());
                        //xx console.log(results[0].toString());
                        dataValue.sourceTimestamp.getTime().should.eql(date.getTime());
                        dataValue.sourcePicoseconds.should.eql(1120); // we're only accurate at 10th of a picosecond
                        dataValue.statusCode.should.eql(opcua.StatusCodes.UncertainSensorNotAccurate);
                        done();
                    });
                });
            }, done);

        });
    });
};
