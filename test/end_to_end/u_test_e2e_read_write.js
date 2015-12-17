"use strict";
/* global describe,it,before,after,beforeEach,afterEach*/
require("requirish")._(module);

var async = require("async");
var should = require("should");
var build_server_with_temperature_device = require("test/helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;

var opcua = require("index");
var makeNodeId = opcua.makeNodeId;
var DataType = opcua.DataType;
var AttributeIds = opcua.AttributeIds;
var OPCUAClient = opcua.OPCUAClient;

var address_space_for_conformance_testing = require("lib/simulation/address_space_for_conformance_testing");
var build_address_space_for_conformance_testing = address_space_for_conformance_testing.build_address_space_for_conformance_testing;

function sameVariant(v1, v2) {
    if (v1.dataType !== v2.dataType) {
        return false;
    }
    if (v1.arrayType !== v2.arrayType) {
        return false;
    }
    if (v1.value !== v2.value) {
        return false;
    }
    return true;
}

function sameDate(d1, d2) {
    if (!d1) {
        return !d2;
    }
    if (!d2) {
        return !d1;
    }
    return d1.getTime() === d2.getTime();
}

function sameDataValue(dv1, dv2) {

    if (dv1.statusCode !== dv2.statusCode) {
        return false;
    }

    if (!sameVariant(dv1.statusCode, dv2.statusCode)) {
        return false;
    }
    return true;
}

module.exports = function (test) {

    describe("end-to-end testing of read and write operation on a Variable", function () {


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
                        //xx console.log(results[0].toString());

                        // verify that value and status codes are identical
                        if (!sameDataValue(dataValue, results[0])) {
                            console.log(" ------- > expected".yellow);
                            console.log(dataValue.toString().yellow);
                            console.log(" ------- > actuel".cyan);
                            console.log(results[0].toString().cyan);
                            // dataValue.toString().split("\n").should.eql(results[0].toString().split("\n"));
                            return inner_done(new Error("dataValue is not as expected"));
                        }
                        // verify that server provides a valid serverTimestamp and sourceTimestamp, regardless
                        // of what we wrote into the variable
                        results[0].serverTimestamp.should.be.instanceOf(Date);
                        results[0].sourceTimestamp.should.be.instanceOf(Date);
                        inner_done(err);
                    });
                });

            }, done);

        }

        it("writing dataValue case 1", function (done) {

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
        it("writing dataValue case 2", function (done) {

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
        it("writing dataValue case 3", function (done) {

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

                        session.performMessageTransaction(request, function (err, response) {
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

                        session.performMessageTransaction(request, function (err, response) {
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

                        session.performMessageTransaction(request, function (err, response) {
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
                    session.read(nodesToRead, function (err, r, results) {
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
                                session.read(nodesToRead, function (err, r, results) {
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