"use strict";

var should = require("should");
var async = require("async");
var _ = require("underscore");

var opcua = require("node-opcua");
var OPCUAClient = opcua.OPCUAClient;
var StatusCodes = opcua.StatusCodes;
var DataType = opcua.DataType;
var AttributeIds = opcua.AttributeIds;
var BrowseDirection = opcua.BrowseDirection;
var client_utils = opcua.client_utils;

var debugLog = require("node-opcua-debug").make_debugLog(__filename);


var port = 2000;

var build_server_with_temperature_device = require("../../test_helpers/build_server_with_temperature_device").build_server_with_temperature_device;

var describe = require("node-opcua-test-helpers/src/resource_leak_detector").describeWithLeakDetector;

describe("testing AnalogItem on client side", function () {

    var server, client, temperatureVariableId, endpointUrl;

    this.timeout(Math.max(600000,this._timeout));

    var g_session = null;
    before(function (done) {

        server = build_server_with_temperature_device({port: port}, function (err) {
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done(err);
        });
    });

    beforeEach(function (done) {
        client = new OPCUAClient();
        async.series([
            function (callback) {
                client.connect(endpointUrl, callback);
            },
            function (callback) {
                debugLog(" createSession");
                client.createSession(function (err, session) {
                    g_session = session;
                    debugLog(" Error =".yellow.bold, err);
                    callback(err);
                });
            }
        ], done);
    });

    afterEach(function (done) {
        async.series([
            function (callback) {
                debugLog("closing session");
                if (g_session) {
                    g_session.close(callback);
                    g_session = null;
                } else {
                    callback(null);
                }
            },
            function (callback) {
                client.disconnect(callback);
            }
        ], done);
    });

    after(function (done) {
        server.shutdown(done);
    });


    it("readUAAnalogItem should extract all properties of a UAAnalogItem ", function (done) {


        var nodeId = "ns=4;s=TemperatureAnalogItem";

        client_utils.readUAAnalogItem(g_session, nodeId, function (err, data) {

            if (err) { return done(err); }

            data.should.have.ownProperty("engineeringUnits");
            data.should.have.ownProperty("engineeringUnitsRange");
            data.should.have.ownProperty("instrumentRange");
            data.should.have.ownProperty("valuePrecision");
            data.should.have.ownProperty("definition");

            done();

        });

    });
    it("readUAAnalogItem should return an error if not doesn't exist", function (done) {
        var nodeId = "ns=4;s=invalidnode";
        client_utils.readUAAnalogItem(g_session, nodeId, function (err, data) {
            should.exist(err);
            done();
        });

    });

    /**
     * find the nodeId that matches  property  named 'browseName' on a given node
     * @param nodeId
     * @param browseName
     * @param callback
     */
    function findProperty(g_session, nodeId, browseName, callback) {

        var browseDescription = {
            nodeId: nodeId,
            referenceTypeId: "HasProperty",
            browseDirection: BrowseDirection.Forward,
            resultMask: 0x3F
        };
        g_session.browse(browseDescription, function (err, result) {

            if (err) { return callback(err); }

            result = result[0];
            if (result.statusCode !== StatusCodes.Good) {
                return callback(null, null);
            }

            var tmp = _.filter(result.references, function (e) {
                console.log("     ", e.nodeId.toString(), e.browseName.name.yellow);
                return e.browseName.name === browseName;
            });
            tmp = tmp.map(function (e) {
                return e.nodeId;
            });
            var found = (tmp.length === 1) ? tmp[0] : null;
            callback(null, found);

        });
    }


    it("should read the EURange property of an analog item", function (done) {

        var nodeId = "ns=4;s=TemperatureAnalogItem";

        findProperty(g_session, nodeId, "EURange", function (err, propertyId) {

            if (err) {
                return done(err);
            }

            should.exist(propertyId);

            var nodeToRead = {
                nodeId: propertyId,
                attributeId: AttributeIds.Value
            };
            console.log("propertyId = ", propertyId.toString());
            g_session.read([nodeToRead], function (err, nodeToRead, results) {
                if (err) {
                    return done(err);
                }
                var result = results[0];
                //xx console.log("result = ",result.toString());
                result.value.dataType.should.eql(DataType.ExtensionObject);

                result.value.value.low.should.eql(100);
                result.value.value.high.should.eql(200);

                done(err);
            });
        });

    });
});




