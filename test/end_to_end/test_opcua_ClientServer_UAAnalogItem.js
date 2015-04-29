require("requirish")._(module);

var should = require("should");
var assert = require("better-assert");
var async = require("async");
var util = require("util");
var _ = require("underscore");

var opcua = require("index");
var OPCUAClient = opcua.OPCUAClient;
var StatusCodes = opcua.StatusCodes;
var Variant =  opcua.Variant ;
var DataType = opcua.DataType;
var DataValue = opcua.DataValue;

var BrowseDirection = opcua.browse_service.BrowseDirection;
var debugLog  = opcua.utils.make_debugLog(__filename);




var port = 2000;

var build_server_with_temperature_device = require("test/helpers/build_server_with_temperature_device").build_server_with_temperature_device;


describe("testing UAAnalogItem on client side",function() {

    var server, client, temperatureVariableId, endpointUrl;

    this.timeout(10000);

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
                if (g_session) { g_session.close(callback);g_session=null; } else { callback(null);}
            },
            function (callback) {
                client.disconnect(callback);
            }
        ], done);
    });

    after(function (done) {
        server.shutdown(done);
    });

    var client_utils = require("lib/client/client_utils");

    it("readUAAnalogItem should extract all properties of a UAAnalogItem ", function (done) {


        var nodeId = "ns=4;s=TemperatureAnalogItem";
        client_utils.readUAAnalogItem(g_session,nodeId,function(err,data ){

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
        client_utils.readUAAnalogItem(g_session,nodeId,function(err,data ) {
            should(err).not.eql(null);
            done();
        });

    });
});




