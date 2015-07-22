require("requirish")._(module);

var should = require("should");
var assert = require("better-assert");
var async = require("async");
var util = require("util");
var _ = require("underscore");

var opcua = require("index");
var resolveNodeId = opcua.resolveNodeId;

var OPCUAClient = opcua.OPCUAClient;
var StatusCodes = opcua.StatusCodes;
var Variant = opcua.Variant;
var DataType = opcua.DataType;
var DataValue = opcua.DataValue;

var BrowseDirection = opcua.browse_service.BrowseDirection;
var debugLog = opcua.utils.make_debugLog(__filename);

var port = 2000;

var build_server_with_temperature_device = require("test/helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;

describe("Test Browse Request", function () {

    var server, client, temperatureVariableId, endpointUrl;

    before(function (done) {
        resourceLeakDetector.start();
        server = build_server_with_temperature_device({port: port}, function (err) {
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done(err);
        });
    });

    var g_session = null;
    beforeEach(function (done) {

        client = new OPCUAClient();
        client.connect(endpointUrl, function (err) {
            if (err) {
                done(err);
            }
            else {
                client.createSession(function (err, session) {
                    g_session = session;
                    done(err);
                });
            }
        });

    });

    afterEach(function (done) {
        g_session.close(function () {
            client.disconnect(done);
        });
    });

    after(function (done) {
        server.shutdown(function (err) {
            resourceLeakDetector.stop();
            done(err);
        });
    });


    it("T1 - #Browse should return BadNothingToDo if nodesToBrowse is empty ", function (done) {


        var browseRequest = new opcua.browse_service.BrowseRequest({
            nodesToBrowse: []
        });
        g_session.performMessageTransaction(browseRequest, function (err, result) {
            err.message.should.match(/BadNothingToDo/);
            // todo
            done();
        });

    });

    it("T2 - #Browse should return BadViewIdInvalid if viewId is invalid", function (done) {

        var browseDesc = {
            nodeId: resolveNodeId("RootFolder"),
            referenceTypeId: null,
            browseDirection: BrowseDirection.Forward
        };

        var browseRequest = new opcua.browse_service.BrowseRequest({
            view: {
                viewId: 'ns=1256;i=1' //<< invalid viewId
            },
            nodesToBrowse: [browseDesc]
        });
        g_session.performMessageTransaction(browseRequest, function (err, result) {
            err.message.should.match(/BadViewIdUnknown/);
            done();
        });
    });

    it("T3 - #Browse should return BadViewUnknown if object referenced by viewId is not a view", function (done) {

        var browseDesc = {
            nodeId: resolveNodeId("RootFolder"),
            referenceTypeId: null,
            browseDirection: BrowseDirection.Forward
        };

        var browseRequest = new opcua.browse_service.BrowseRequest({
            view: {
                viewId: 'ns=0;i=85',
            },
            nodesToBrowse: [browseDesc]
        });
        g_session.performMessageTransaction(browseRequest, function (err, result) {
            // todo
            err.message.should.match(/BadViewIdUnknown/);
            done();
        });
    });

    it("T4 - #Browse server should respect Browse maxReferencesPerNode ", function (done) {

        var browseDesc = {
            nodeId: resolveNodeId("RootFolder"),
            referenceTypeId: null,
            includeSubtypes: true,
            browseDirection: BrowseDirection.Both,
            resultMask: 63
        };

        async.series([

            function (callback) {
                var browseRequest1 = new opcua.browse_service.BrowseRequest({
                    view: null,//{ viewId: 'ns=0;i=85'},
                    requestedMaxReferencesPerNode: 10,
                    nodesToBrowse: [browseDesc]
                });
                g_session.performMessageTransaction(browseRequest1, function (err, response) {
                    // console.log(response.toString());
                    response.results[0].statusCode.should.eql(StatusCodes.Good);
                    response.results[0].references.length.should.be.greaterThan(3);
                    should(response.results[0].continuationPoint).eql(null);
                    callback();
                });
            },
            function (callback) {
                var browseRequest2 = new opcua.browse_service.BrowseRequest({
                    view: null,//{ viewId: 'ns=0;i=85'},
                    requestedMaxReferencesPerNode: 1,
                    nodesToBrowse: [browseDesc]
                });
                g_session.performMessageTransaction(browseRequest2, function (err, response) {
                    //xx console.log(response.toString());
                    response.results[0].statusCode.should.eql(StatusCodes.Good);
                    response.results[0].references.length.should.be.eql(1);
                    should(response.results[0].continuationPoint).not.eql(null);
                    callback();
                });
            }
        ], done);


    });

    it("T5 - #BrowseNext response should have serviceResult=BadNothingToDo if request have no continuationPoints", function (done) {
        async.series([

            function (callback) {
                var browseNextRequest = new opcua.browse_service.BrowseNextRequest({
                    continuationPoints: null,
                });
                g_session.performMessageTransaction(browseNextRequest, function (err, response) {
                    // console.log(response.toString());
                    response.responseHeader.serviceResult.should.equal(StatusCodes.BadNothingToDo);
                    callback();
                });
            }
        ], done);
    });
    it("T6 - #BrowseNext response ", function (done) {
        var browseDesc = {
            nodeId: resolveNodeId("RootFolder"),
            referenceTypeId: null,
            includeSubtypes: true,
            browseDirection: BrowseDirection.Both,
            resultMask: 63
        };

        var allReferences;
        var continuationPoint;
        async.series([

            function (callback) {
                var browseRequest1 = new opcua.browse_service.BrowseRequest({
                    view: null,//{ viewId: 'ns=0;i=85'},
                    requestedMaxReferencesPerNode: 10,
                    nodesToBrowse: [browseDesc]
                });
                g_session.performMessageTransaction(browseRequest1, function (err, response) {
                    // console.log(response.toString());
                    response.results[0].statusCode.should.eql(StatusCodes.Good);
                    response.results[0].references.length.should.be.greaterThan(3); // want 4 at lest
                    should(response.results[0].continuationPoint).eql(null);
                    allReferences = response.results[0].references;
                    callback();
                });
            },

            function (callback) {
                var browseRequest2 = new opcua.browse_service.BrowseRequest({
                    view: null,//{ viewId: 'ns=0;i=85'},
                    requestedMaxReferencesPerNode: 2,
                    nodesToBrowse: [browseDesc]
                });
                g_session.performMessageTransaction(browseRequest2, function (err, response) {
                    //xx console.log(response.toString());

                    response.results.length.should.eql(1);
                    response.results[0].statusCode.should.eql(StatusCodes.Good);
                    response.results[0].references.length.should.be.eql(2);
                    should(response.results[0].continuationPoint).not.eql(null);
                    assert(response.results[0].references[0].should.eql(allReferences[0]));
                    assert(response.results[0].references[1].should.eql(allReferences[1]));

                    continuationPoint = response.results[0].continuationPoint;

                    callback();
                });
            },

            function (callback) {
                var browseNextRequest = new opcua.browse_service.BrowseNextRequest({
                    continuationPoints: [continuationPoint],
                });
                g_session.performMessageTransaction(browseNextRequest, function (err, response) {
                    // console.log(response.toString());
                    response.responseHeader.serviceResult.should.equal(StatusCodes.Good);

                    response.results.length.should.eql(1);
                    response.results[0].statusCode.should.eql(StatusCodes.Good);
                    response.results[0].references.length.should.be.eql(2);

                    // this is last request
                    should(response.results[0].continuationPoint).eql(null);

                    assert(response.results[0].references[0].should.eql(allReferences[2]));
                    assert(response.results[0].references[1].should.eql(allReferences[3]));

                    callback();

                });

            },

            // we reach the end of the sequence. continuationPoint shall not be usable anymore
            function (callback) {
                var browseNextRequest = new opcua.browse_service.BrowseNextRequest({
                    continuationPoints: [continuationPoint],
                });
                g_session.performMessageTransaction(browseNextRequest, function (err, response) {
                    // console.log(response.toString());
                    response.responseHeader.serviceResult.should.equal(StatusCodes.Good);
                    response.results.length.should.eql(1);
                    response.results[0].statusCode.should.eql(StatusCodes.BadContinuationPointInvalid);
                    callback();
                });
            }


        ], done);

    });


});
