"use strict";
/*global describe, it, beforeEach, afterEach */

const async = require("async");
const should = require("should");
const perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;

const opcua = require("node-opcua");
const makeNodeId = opcua.makeNodeId;
const OPCUAClient = opcua.OPCUAClient;

const sameDataValue = opcua.sameDataValue;

module.exports = function (test) {

    describe("JHJ1 end-to-end testing of read and write operation on a Variable", function () {


        let client, endpointUrl;

        beforeEach(function (done) {
            client = new OPCUAClient();
            endpointUrl = test.endpointUrl;
            done();
        });

        afterEach(function (done) {
            client = null;
            done();
        });

        const namespaceIndex = 2;


        function test_write_read_cycle(client, dataValue, done) {

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                const nodeId = "ns=2;s=Scalar_Static_Float";

                const nodesToWrite = [
                    {
                        nodeId: nodeId,
                        attributeId: opcua.AttributeIds.Value,
                        indexRange: null,
                        value: dataValue
                    }
                ];
                session.write(nodesToWrite, function (err, results) {

                    if (err) {
                        return inner_done(err);
                    }
                    results.length.should.eql(1);
                    results[0].should.eql(opcua.StatusCodes.Good);

                    const nodesToRead = [
                        {
                            nodeId: nodeId,
                            attributeId: opcua.AttributeIds.Value,
                            indexRange: null,
                            dataEncoding: null
                        }
                    ];
                    session.read(nodesToRead, function (err, dataValues) {

                        // note if dataValue didn't specied the timestamp it should not be overwritten.
                        if (!dataValue.serverTimestamp) {
                            should.exist(dataValues[0].serverTimestamp);
                            dataValue.serverTimestamp =dataValues[0].serverTimestamp;
                            dataValue.serverPicoseconds =dataValues[0].serverPicoseconds;
                        }
                        if (!dataValue.sourceTimestamp) {
                            dataValue.sourceTimestamp =dataValues[0].sourceTimestamp;
                            dataValue.sourcePicoseconds =dataValues[0].sourcePicoseconds;
                        }



                        //xx console.log(results[0].toString());

                        // verify that server provides a valid serverTimestamp and sourceTimestamp, regardless
                        // of what we wrote into the variable
                        dataValues[0].serverTimestamp.should.be.instanceOf(Date);
                        dataValues[0].sourceTimestamp.should.be.instanceOf(Date);


                        // verify that value and status codes are identical
                        (dataValues[0].serverTimestamp.getTime()+1).should.be.greaterThan(dataValue.serverTimestamp.getTime());

                        // now disregard serverTimestamp
                        dataValue.serverTimestamp = null;
                        dataValues[0].serverTimestamp = null;
                        if (!sameDataValue(dataValue, dataValues[0])) {
                            console.log(" ------- > expected".yellow);
                            console.log(dataValue.toString().yellow);
                            console.log(" ------- > actual".cyan);
                            console.log(dataValues[0].toString().cyan);
                            // dataValue.toString().split("\n").should.eql(results[0].toString().split("\n"));
                            return inner_done(new Error("dataValue is not as expected"));
                        }
                        inner_done(err);
                    });
                });

            }, done);

        }

        it("writing dataValue case 1 - both serverTimestamp and sourceTimestamp are specified ", function (done) {

            const dataValue = new opcua.DataValue({

                serverTimestamp: new Date(2015, 5, 2),
                serverPicoseconds: 20,

                sourceTimestamp: new Date(2015, 5, 3),
                sourcePicoseconds: 30,

                value: {
                    dataType: opcua.DataType.Float,
                    value: 32.0
                }
            });
            test_write_read_cycle(client, dataValue, done);

        });
        it("writing dataValue case 2 - serverTimestamp is null & sourceTimestamp is specified", function (done) {

            const dataValue = new opcua.DataValue({

                serverTimestamp: null,
                serverPicoseconds: 0,

                sourceTimestamp: new Date(2015, 5, 3),
                sourcePicoseconds: 30,

                value: {
                    dataType: opcua.DataType.Float,
                    value: 32.0
                }
            });

            test_write_read_cycle(client, dataValue, done);

        });
        it("writing dataValue case 3 - serverTimestamp is null & sourceTimestamp is null ", function (done) {

            const dataValue = new opcua.DataValue({
                serverTimestamp: null,
                serverPicoseconds: 0,
                sourceTimestamp: null,
                sourcePicoseconds: 0,
                value: {
                    dataType: opcua.DataType.Float,
                    value: 32.0
                }
            });
            test_write_read_cycle(client, dataValue, done);

        });

        it("ZZZ reading ns=2;s=Scalar_Static_Int16 ", function (done) {
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
                const nodeId = "ns=2;s=Scalar_Static_Int16";

                const nodesToRead = [
                    {
                        nodeId: nodeId,
                        attributeId: opcua.AttributeIds.Value,
                        indexRange: null,
                        dataEncoding: null
                    }
                ];

                const maxAge = 10;

                async.series([
                    function (callback) {
                        const request = new opcua.ReadRequest({
                            nodesToRead: nodesToRead,
                            maxAge: maxAge,
                            timestampsToReturn: opcua.TimestampsToReturn.Both
                        });

                        session.performMessageTransaction(request, function (err/*, response*/) {
                            //xx console.log(response.results[0].toString());
                            callback(err);
                        });

                    },
                    function (callback) {
                        const request = new opcua.ReadRequest({
                            nodesToRead: nodesToRead,
                            maxAge: maxAge,
                            timestampsToReturn: opcua.TimestampsToReturn.Both
                        });

                        session.performMessageTransaction(request, function (err/*, response*/) {
                            //xx console.log(response.results[0].toString());
                            callback(err);
                        });

                    },
                    function (callback) {

                        const request = new opcua.ReadRequest({
                            nodesToRead: nodesToRead,
                            maxAge: maxAge,
                            timestampsToReturn: opcua.TimestampsToReturn.Server
                        });

                        session.performMessageTransaction(request, function (err/*, response*/) {
                            //xx console.log(response.results[0].toString());
                            callback(err);
                        });
                    }
                ], inner_done);
            }, done);
        });

        xit("#read test maxAge", function (done) {
            done();
        });

        describe("Performance of reading large array", function () {

            it("PERF - READ testing performance of large array", function (done) {

                perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                    const nodeId = "s="+"Scalar_Static_Large_Array_Float";

                    const nodeToRead =  {
                            nodeId: nodeId,
                            attributeId: opcua.AttributeIds.Value,
                            indexRange: null,
                            dataEncoding: null
                        };
                    session.read(nodeToRead, function (err, dataValue) {
                        //xx console.log(results[0].toString());
                        should.exist(dataValue);
                        inner_done(err);
                    });


                }, done);
            });
            it("PERF - WRITE testing performance of large array", function (done) {

                perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                    const nodeId = "ns=2;s=Scalar_Static_Large_Array_Float";
                    const nodeToRead = {
                            nodeId: nodeId,
                            attributeId: opcua.AttributeIds.Value,
                            indexRange: null,
                            dataEncoding: null
                        };
                    session.read(nodeToRead, function (err,dataValue) {

                        if (err) {
                            return inner_done(err);
                        }

                        //xx console.log(results[0].toString());

                        const variant = dataValue.value;
                        variant.value[1] = 2;
                        variant.value[3] = 2;
                        variant.value[4] = 2;
                        //xx console.log(results[0].toString());
                        const nodesToWrite = [
                            {
                                nodeId: nodeId,
                                attributeId: opcua.AttributeIds.Value,
                                indexRange: null,
                                value: dataValue
                            }
                        ];
                        session.write(nodesToWrite, function (err) {
                            if (err) {
                                return inner_done(err);
                            }

                            //xx console.log(nodesToWrite[0].value.value.value.constructor.name);

                            nodesToWrite[0].value.value.value.should.be.instanceof(Float32Array);
                            nodesToWrite[0].value.value.value = new Float32Array(1024 * 1024);
                            session.write(nodesToWrite, function (err) {
                                if (err) {
                                    return inner_done(err);
                                }
                                session.read(nodeToRead, function (err, dataValue) {
                                    should.exist(dataValue);
                                    //xx console.log(results[0].toString());
                                    inner_done(err);
                                });
                            });
                        });

                    });
                }, done);
            });
        });
    });
};