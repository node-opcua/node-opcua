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


module.exports = function (test) {

    describe("QSD Test Browse Request", function () {

        var client, endpointUrl;

        var g_session = null;
        beforeEach(function (done) {

            endpointUrl = test.endpointUrl;

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


        it("T6 - #BrowseNext response ", function (done) {

            var nodeToBrowse = {
                nodeId: resolveNodeId("i=29"),
                referenceTypeId: null,
                includeSubtypes: false,
                browseDirection: BrowseDirection.Forward,
                resultMask: 63,
                nodeClassMask: 255
            };

            var allReferences;
            async.series([

                function (callback) {
                    var browseRequest1 = new opcua.browse_service.BrowseRequest({
                        view: null,
                        requestedMaxReferencesPerNode: 0,
                        nodesToBrowse: [nodeToBrowse]
                    });
                    g_session.performMessageTransaction(browseRequest1, function (err, response) {
                        if (err) {
                            return callback(err);
                        }
                        // console.log(response.toString());
                        response.results[0].statusCode.should.eql(StatusCodes.Good);
                        response.results[0].references.length.should.be.greaterThan(3); // want 4 at lest
                        should(response.results[0].continuationPoint).eql(null);
                        allReferences = response.results[0].references;
                        callback();
                    });
                },
                function (callback) {
                    callback();
                }
            ], done);

        });


    });
};