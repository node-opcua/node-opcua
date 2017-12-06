"use strict";
/*global describe, it, beforeEach, afterEach */

var async = require("async");
var should = require("should");
var perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;

var opcua = require("node-opcua");
var makeNodeId = opcua.makeNodeId;
var OPCUAClient = opcua.OPCUAClient;

var sameDataValue = opcua.sameDataValue;

module.exports = function (test) {

    describe("JHJ1 end-to-end testing of read and write operation on a Variable", function () {


        var client, endpointUrl;

        beforeEach(function (done) {
            client = new OPCUAClient();
            endpointUrl = test.endpointUrl;
            done();
        });

        afterEach(function (done) {
            client = null;
            done();
        });

        var namespaceIndex = 411;


        function test_write_read_cycle(client, dataValue, done) {

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                var nodeId = makeNodeId("Scalar_Static_Float", namespaceIndex);

                var nodesToWrite = [
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

                    var nodesToRead = [
                        {
                            nodeId: nodeId,
                            attributeId: opcua.AttributeIds.Value,
                            indexRange: null,
                            dataEncoding: null
                        }
                    ];
                    session.read(nodesToRead, function (err, r, results) {

                        // note if dataValue didn't specied the timestamp it should not be overwritten.
                        if (!dataValue.serverTimestamp) {
                            should.exist(results[0].serverTimestamp);
                            dataValue.serverTimestamp =results[0].serverTimestamp;
                            dataValue.serverPicoseconds =results[0].serverPicoseconds;
                        }
                        if (!dataValue.sourceTimestamp) {
                            dataValue.sourceTimestamp =results[0].sourceTimestamp;
                            dataValue.sourcePicoseconds =results[0].sourcePicoseconds;
                        }



                        //xx console.log(results[0].toString());

                        // verify that server provides a valid serverTimestamp and sourceTimestamp, regardless
                        // of what we wrote into the variable
                        results[0].serverTimestamp.should.be.instanceOf(Date);
                        results[0].sourceTimestamp.should.be.instanceOf(Date);


                        // verify that value and status codes are identical
                        (results[0].serverTimestamp.getTime()+1).should.be.greaterThan(dataValue.serverTimestamp.getTime());

                        // now disregard serverTimestamp
                        dataValue.serverTimestamp = null;
                        results[0].serverTimestamp = null;
                        if (!sameDataValue(dataValue, results[0])) {
                            console.log(" ------- > expected".yellow);
                            console.log(dataValue.toString().yellow);
                            console.log(" ------- > actual".cyan);
                            console.log(results[0].toString().cyan);
                            // dataValue.toString().split("\n").should.eql(results[0].toString().split("\n"));
                            return inner_done(new Error("dataValue is not as expected"));
                        }
                        inner_done(err);
                    });
                });

            }, done);

        }

        it("writing dataValue case 1 - both serverTimestamp and sourceTimestamp are specified ", function (done) {

            var dataValue = new opcua.DataValue({

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

            var dataValue = new opcua.DataValue({

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

            var dataValue = new opcua.DataValue({
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

        it("ZZZ reading ns=411;s=Scalar_Static_Int16 ", function (done) {
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
                var nodeId = makeNodeId("Scalar_Static_Int16", namespaceIndex);

                var nodesToRead = [
                    {
                        nodeId: nodeId,
                        attributeId: opcua.AttributeIds.Value,
                        indexRange: null,
                        dataEncoding: null
                    }
                ];

                var maxAge = 10;

                async.series([
                    function (callback) {
                        var request = new opcua.read_service.ReadRequest({
                            nodesToRead: nodesToRead,
                            maxAge: maxAge,
                            timestampsToReturn: opcua.read_service.TimestampsToReturn.Both
                        });

                        session.performMessageTransaction(request, function (err/*, response*/) {
                            //xx console.log(response.results[0].toString());
                            callback(err);
                        });

                    },
                    function (callback) {
                        var request = new opcua.read_service.ReadRequest({
                            nodesToRead: nodesToRead,
                            maxAge: maxAge,
                            timestampsToReturn: opcua.read_service.TimestampsToReturn.Both
                        });

                        session.performMessageTransaction(request, function (err/*, response*/) {
                            //xx console.log(response.results[0].toString());
                            callback(err);
                        });

                    },
                    function (callback) {

                        var request = new opcua.read_service.ReadRequest({
                            nodesToRead: nodesToRead,
                            maxAge: maxAge,
                            timestampsToReturn: opcua.read_service.TimestampsToReturn.Server
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

                    var nodeId = makeNodeId("Scalar_Static_Large_Array_Float", namespaceIndex);

                    var nodesToRead = [
                        {
                            nodeId: nodeId,
                            attributeId: opcua.AttributeIds.Value,
                            indexRange: null,
                            dataEncoding: null
                        }
                    ];
                    session.read(nodesToRead, function (err/*, r, results*/) {
                        //xx console.log(results[0].toString());

                        inner_done(err);
                    });


                }, done);
            });
            it("PERF - WRITE testing performance of large array", function (done) {

                perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                    var nodeId = makeNodeId("Scalar_Static_Large_Array_Float", namespaceIndex);
                    var nodesToRead = [
                        {
                            nodeId: nodeId,
                            attributeId: opcua.AttributeIds.Value,
                            indexRange: null,
                            dataEncoding: null
                        }
                    ];
                    session.read(nodesToRead, function (err, r, results) {

                        if (err) {
                            return inner_done(err);
                        }

                        //xx console.log(results[0].toString());

                        var variant = results[0].value;
                        variant.value[1] = 2;
                        variant.value[3] = 2;
                        variant.value[4] = 2;
                        //xx console.log(results[0].toString());
                        var nodesToWrite = [
                            {
                                nodeId: nodeId,
                                attributeId: opcua.AttributeIds.Value,
                                indexRange: null,
                                value: results[0]
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
                                session.read(nodesToRead, function (err/*, r, results*/) {
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