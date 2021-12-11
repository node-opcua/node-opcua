"use strict";

const async = require("async");
const should = require("should");

const { makeBrowsePath, OPCUAClient, StatusCodes, VariantArrayType, DataType } = require("node-opcua");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

module.exports = function (test) {
    describe("Testing issue  #223 -  Demonstrating how to use call service from client", function () {
        it("#223 - calling a method with one input argument", function (done) {
            const client1 = OPCUAClient.create();
            const endpointUrl = test.endpointUrl;
            let the_session;
            let objectWithMethodsNodeId;
            let methodIONodeId;

            async.series(
                [
                    function (callback) {
                        client1.connect(endpointUrl, callback);
                    },

                    // create a session using client1
                    function (callback) {
                        client1.createSession(function (err, session) {
                            if (err) {
                                return callback(err);
                            }
                            the_session = session;
                            callback();
                        });
                    },

                    // ------------------------- Call method without arguments

                    function (callback) {
                        const path = makeBrowsePath("RootFolder", "/Objects/2:Simulation/2:ObjectWithMethods");
                        the_session.translateBrowsePath(path, function (err, results) {
                            if (!err) {
                                if (results.targets.length > 0) {
                                    objectWithMethodsNodeId = results.targets[0].targetId;
                                } else {
                                    // cannot find objectWithMethodNodeId
                                    console.log("cannot find objectWithMethods", results.toString());
                                    err = new Error(" cannot find objectWithMethods");
                                }
                            }
                            callback(err);
                        });
                    },

                    function (callback) {
                        const path = makeBrowsePath(objectWithMethodsNodeId, ".2:MethodIO");
                        the_session.translateBrowsePath(path, function (err, results) {
                            if (!err) {
                                if (results.targets.length > 0) {
                                    methodIONodeId = results.targets[0].targetId;
                                } else {
                                    // cannot find objectWithMethodNodeId
                                    console.log("cannot find MethodIO", results.toString());
                                    err = new Error(" cannot find MethodIO");
                                }
                            }
                            callback(err);
                        });
                    },
                    // ------------------------- Call method

                    function (callback) {
                        const methodsToCall = [];
                        methodsToCall.push({
                            objectId: objectWithMethodsNodeId,
                            methodId: methodIONodeId,
                            inputArguments: [
                                {
                                    dataType: DataType.UInt32,
                                    arrayType: VariantArrayType.Scalar,
                                    value: 32
                                }
                            ] //OK
                        });
                        the_session.call(methodsToCall, function (err, results) {
                            results.length.should.eql(1);
                            results[0].statusCode.should.eql(StatusCodes.Good);
                            ///xx console.log(results[0].toString());
                            callback(err);
                        });
                    },

                    function (callback) {
                        the_session.close(callback);
                    },

                    function (callback) {
                        client1.disconnect(function () {
                            callback();
                        });
                    }
                ],
                done
            );
        });
    });
};
