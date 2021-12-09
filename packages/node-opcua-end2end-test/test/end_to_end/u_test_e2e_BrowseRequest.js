
const should = require("should");
const { assert } = require("node-opcua-assert");
const async = require("async");
const util = require("util");

const {
    resolveNodeId,
    OPCUAClient,
    StatusCodes,
    BrowseDirection,
    BrowseRequest, 
    BrowseNextRequest, 
    BrowseDescription
} = require("node-opcua");

const { make_debugLog, checkDebugFlag } = require("node-opcua-debug");
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");


const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
module.exports = function(test) {

    describe("Test Browse Request", function() {

        let client, endpointUrl;

        let g_session = null;
        beforeEach(function(done) {

            endpointUrl = test.endpointUrl;

            client = OPCUAClient.create();
            client.connect(endpointUrl, function(err) {
                if (err) {
                    done(err);
                }
                else {
                    client.createSession(function(err, session) {
                        g_session = session;
                        done(err);
                    });
                }
            });

        });

        afterEach(function(done) {
            g_session.close(function() {
                client.disconnect(done);
            });
        });

        it("T1 - #Browse should return BadNothingToDo if nodesToBrowse is empty ", function(done) {

            const browseRequest = new BrowseRequest({
                nodesToBrowse: []
            });
            g_session.performMessageTransaction(browseRequest, function(err, result) {
                err.message.should.match(/BadNothingToDo/);
                // todo
                done();
            });

        });

        it("T2 - #Browse should return BadViewIdInvalid if viewId is invalid", function(done) {

            const browseDesc = {
                nodeId: resolveNodeId("RootFolder"),
                referenceTypeId: null,
                browseDirection: BrowseDirection.Forward
            };

            const browseRequest = new BrowseRequest({
                view: {
                    viewId: 'ns=1256;i=1' //<< invalid viewId
                },
                nodesToBrowse: [browseDesc]
            });
            g_session.performMessageTransaction(browseRequest, function(err, result) {
                err.message.should.match(/BadViewIdUnknown/);
                done();
            });
        });

        it("T3 - #Browse should return BadViewUnknown if object referenced by viewId is not a view", function(done) {

            const browseDesc = {
                nodeId: resolveNodeId("RootFolder"),
                referenceTypeId: null,
                browseDirection: BrowseDirection.Forward
            };

            const browseRequest = new BrowseRequest({
                view: {
                    viewId: 'ns=0;i=85',
                },
                nodesToBrowse: [browseDesc]
            });
            g_session.performMessageTransaction(browseRequest, function(err, result) {
                // todo
                err.message.should.match(/BadViewIdUnknown/);
                done();
            });
        });

        it("T4 - #Browse server should respect Browse maxReferencesPerNode ", function(done) {

            const browseDesc = {
                nodeId: resolveNodeId("RootFolder"),
                referenceTypeId: null,
                includeSubtypes: true,
                browseDirection: BrowseDirection.Both,
                resultMask: 63
            };

            async.series([

                function(callback) {
                    const browseRequest1 = new BrowseRequest({
                        view: null,//{ viewId: 'ns=0;i=85'},
                        requestedMaxReferencesPerNode: 10,
                        nodesToBrowse: [browseDesc]
                    });
                    g_session.performMessageTransaction(browseRequest1, function(err, response) {
                        if (err) {
                            return callback(err);
                        }
                        // console.log(response.toString());
                        response.results[0].statusCode.should.eql(StatusCodes.Good);
                        response.results[0].references.length.should.be.greaterThan(3);
                        should(response.results[0].continuationPoint).eql(null);
                        callback();
                    });
                },
                function(callback) {
                    const browseRequest2 = new BrowseRequest({
                        view: null,//{ viewId: 'ns=0;i=85'},
                        requestedMaxReferencesPerNode: 1,
                        nodesToBrowse: [browseDesc]
                    });
                    g_session.performMessageTransaction(browseRequest2, function(err, response) {
                        if (err) {
                            return callback(err);
                        }
                        //xx console.log(response.toString());
                        response.results[0].statusCode.should.eql(StatusCodes.Good);
                        response.results[0].references.length.should.be.eql(1);
                        should.exist(response.results[0].continuationPoint);
                        callback();
                    });
                }
            ], done);


        });

        it("T5 - #BrowseNext response should have serviceResult=BadNothingToDo if request have no continuationPoints", function(done) {
            async.series([

                function(callback) {
                    const browseNextRequest = new BrowseNextRequest({
                        continuationPoints: null
                    });
                    g_session.performMessageTransaction(browseNextRequest, function(err, response) {
                        err.message.should.match(/BadNothingToDo/);
                        // console.log(response.toString());
                        response.responseHeader.serviceResult.should.equal(StatusCodes.BadNothingToDo);
                        callback();
                    });
                }
            ], done);
        });
        it("T6 - #BrowseNext response ", function(done) {
            const browseDesc = {
                nodeId: resolveNodeId("RootFolder"),
                referenceTypeId: null,
                includeSubtypes: true,
                browseDirection: BrowseDirection.Both,
                resultMask: 63
            };

            let allReferences;
            let continuationPoint;
            async.series([

                function(callback) {
                    const browseRequest1 = new BrowseRequest({
                        view: null,//{ viewId: 'ns=0;i=85'},
                        requestedMaxReferencesPerNode: 10,
                        nodesToBrowse: [browseDesc]
                    });
                    g_session.performMessageTransaction(browseRequest1, function(err, response) {
                        if (err) {
                            return callback(err);
                        }
                        // console.log(response.toString());
                        response.results[0].statusCode.should.eql(StatusCodes.Good);
                        response.results[0].references.length.should.be.greaterThan(3); // want 4 at lest
                        should.not.exist(response.results[0].continuationPoint);
                        allReferences = response.results[0].references;
                        callback();
                    });
                },

                function(callback) {
                    const browseRequest2 = new BrowseRequest({
                        view: null,//{ viewId: 'ns=0;i=85'},
                        requestedMaxReferencesPerNode: 2,
                        nodesToBrowse: [browseDesc]
                    });
                    g_session.performMessageTransaction(browseRequest2, function(err, response) {
                        if (err) {
                            return callback(err);
                        }
                        //xx console.log(response.toString());

                        response.results.length.should.eql(1);
                        response.results[0].statusCode.should.eql(StatusCodes.Good);
                        response.results[0].references.length.should.be.eql(2);
                        should.exist(response.results[0].continuationPoint);
                        response.results[0].references[0].should.eql(allReferences[0]);
                        response.results[0].references[1].should.eql(allReferences[1]);

                        continuationPoint = response.results[0].continuationPoint;

                        callback();
                    });
                },

                function(callback) {
                    const browseNextRequest = new BrowseNextRequest({
                        continuationPoints: [continuationPoint],
                        //xx                    releaseContinuationPoints: true
                    });
                    g_session.performMessageTransaction(browseNextRequest, function(err, response) {
                        if (err) {
                            return callback(err);
                        }
                        // console.log(response.toString());
                        response.responseHeader.serviceResult.should.equal(StatusCodes.Good);

                        response.results.length.should.eql(1);
                        response.results[0].statusCode.should.eql(StatusCodes.Good);
                        response.results[0].references.length.should.be.eql(2);

                        // this is last request
                        should.not.exist(response.results[0].continuationPoint);

                        response.results[0].references[0].should.eql(allReferences[2]);
                        response.results[0].references[1].should.eql(allReferences[3]);

                        callback();

                    });

                },

                // we reach the end of the sequence. continuationPoint shall not be usable anymore
                function(callback) {
                    const browseNextRequest = new BrowseNextRequest({
                        continuationPoints: [continuationPoint],
                        releaseContinuationPoints: true
                    });
                    g_session.performMessageTransaction(browseNextRequest, function(err, response) {
                        if (err) {
                            return callback(err);
                        }
                        // console.log(response.toString());
                        response.responseHeader.serviceResult.should.equal(StatusCodes.Good);
                        response.results.length.should.eql(1);
                        response.results[0].statusCode.should.eql(StatusCodes.BadContinuationPointInvalid);
                        callback();
                    });
                }


            ], done);

        });

        const IT = test.server ? it : xit;
        IT("T7 - #BrowseNext with releaseContinuousPoint set to false then set to true", function(done) {
            /*
             * inspired by    Test 5.7.2-9 prepared by Dale Pope dale.pope@matrikon.com
             * Description:
             *   Given one node to browse
             *     And the node exists
             *     And the node has at least three references of the same ReferenceType's subtype
             *     And RequestedMaxReferencesPerNode is 1
             *     And ReferenceTypeId is set to a ReferenceType NodeId
             *     And IncludeSubtypes is true
             *     And Browse has been called
             *  When BrowseNext is called
             *     And ReleaseContinuationPoints is false
             *  Then the server returns the second reference
             *     And ContinuationPoint is not empty
             *     Validation is accomplished by first browsing all references of a type
             *     on a node, then performing the test and comparing the second
             *     reference to the reference returned by the BrowseNext call. So this
             *     test only validates that Browse two references is consistent with
             *     Browse one reference followed by BrowseNext.
             */

            function test_5_7_2__9(nodeId, done) {

                //     And RequestedMaxReferencesPerNode is 1
                //     And ReferenceTypeId is set to a ReferenceType NodeId
                //     And IncludeSubtypes is true
                //     And Browse has been called

                //  Given one node to browse
                nodeId = resolveNodeId(nodeId);
                //     And the node exists
                const obj = test.server.engine.addressSpace.findNode(nodeId, BrowseDirection.Forward);
                should.exist(obj);

                const browseDesc = new BrowseDescription({
                    nodeId: nodeId,
                    referenceTypeId: "i=47", // HasComponents
                    includeSubtypes: true,
                    browseDirection: BrowseDirection.Forward,
                    resultMask: 63
                });


                let continuationPoint;

                let allReferences;

                async.series([

                    // browse all references
                    function(callback) {
                        const browseRequestAll = new BrowseRequest({
                            view: null,//{ viewId: 'ns=0;i=85'},
                            requestedMaxReferencesPerNode: 10,
                            nodesToBrowse: [browseDesc]
                        });
                        g_session.performMessageTransaction(browseRequestAll, function(err, response) {
                            if (err) {
                                return callback(err);
                            }
                            // console.log(response.toString());
                            response.results[0].statusCode.should.eql(StatusCodes.Good);
                            response.results[0].references.length.should.be.greaterThan(3); // want 4 at lest
                            should.not.exist(response.results[0].continuationPoint);
                            allReferences = response.results[0].references;
                            callback();
                        });
                    },

                    function(callback) {

                        const browseRequest1 = new BrowseRequest({
                            view: null,
                            requestedMaxReferencesPerNode: 1,
                            nodesToBrowse: [browseDesc]
                        });

                        g_session.performMessageTransaction(browseRequest1, function(err, response) {
                            if (err) {
                                return callback(err);
                            }
                            //xx console.log(response.toString());

                            response.results.length.should.eql(1);
                            response.results[0].statusCode.should.eql(StatusCodes.Good);
                            response.results[0].references.length.should.be.eql(1);
                            should.exist(response.results[0].continuationPoint);
                            response.results[0].references[0].should.eql(allReferences[0]);
                            continuationPoint = response.results[0].continuationPoint;
                            callback();
                        });
                    },

                    function(callback) {
                        const browseNextRequest = new BrowseNextRequest({
                            releaseContinuationPoints: false,
                            continuationPoints: [continuationPoint]
                        });
                        g_session.performMessageTransaction(browseNextRequest, function(err, response) {
                            if (err) {
                                return callback(err);
                            }
                            // console.log(response.toString());
                            response.responseHeader.serviceResult.should.equal(StatusCodes.Good);

                            response.results.length.should.eql(1);
                            response.results[0].statusCode.should.eql(StatusCodes.Good);
                            response.results[0].references.length.should.be.eql(1);

                            // continuation point should not be null
                            should.exist(response.results[0].continuationPoint);
                            response.results[0].references[0].should.eql(allReferences[1]);
                            callback();

                        });

                    },
                    function(callback) {
                        const browseNextRequest = new BrowseNextRequest({
                            releaseContinuationPoints: true,
                            continuationPoints: [continuationPoint]
                        });
                        g_session.performMessageTransaction(browseNextRequest, function(err, response) {
                            if (err) {
                                return callback(err);
                            }
                            // console.log(response.toString());
                            response.responseHeader.serviceResult.should.equal(StatusCodes.Good);

                            response.results.length.should.eql(1);
                            response.results[0].statusCode.should.eql(StatusCodes.Good);
                            response.results[0].references.length.should.be.eql(0);

                            should.not.exist(response.results[0].continuationPoint);
                            callback();

                        });

                    },

                ], done);

            }

            test_5_7_2__9("ns=0;i=2253", done);

        })

    });
};