// http://opcfoundation.org/UA/SecurityPolicy#Basic256


var opcua = require("../");
var should = require("should");
var assert = require('better-assert');
var async = require("async");
var util = require("util");

var OPCUAServer = opcua.OPCUAServer;
var OPCUAClient = opcua.OPCUAClient;
var StatusCodes = opcua.StatusCodes;
var Variant =  opcua.Variant ;
var DataType = opcua.DataType;
var DataValue = opcua.DataValue;

var BrowseDirection = opcua.browse_service.BrowseDirection;
var debugLog  = opcua.utils.make_debugLog(__filename);




var _ = require("underscore");

var port = 2000;

var build_server_with_temperature_device = require("./helpers/build_server_with_temperature_device").build_server_with_temperature_device;


describe("testing basic Client-Server communication",function() {

    var server , client, temperatureVariableId, endpointUrl;

    before(function (done) {
        // Given a server that have a signed end point
        server = build_server_with_temperature_device({ port: port}, function () {
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done();
        });
    });

    beforeEach(function (done) {
        var options ={
            mode: opcua.MessageSecurityMode.SIGN
        };
        client = new OPCUAClient(options);
        done();
    });

    afterEach(function (done) {

        done();
    });

    after(function (done) {
        server.shutdown(done);
    });

    it("a client shall be able to establish a SIGNED connection with a server (that have a SIGN endpoint)", function (done) {


            server.currentChannelCount.should.equal(0);

            var g_session ;
            async.series([
                function(callback) {
                    debugLog(" connect");
                    client.connect(endpointUrl,function(err){
                        debugLog(" Error =".yellow.bold,err);
                        callback(err);
                    });
                },
                function(callback) {
                    debugLog(" createSession");
                    client.createSession(function(err,session){
                        g_session = session;
                        debugLog(" Error =".yellow.bold,err);
                        callback(err);
                    });

                },
                function(callback) {
                    debugLog("closing session");
                    g_session.close(callback);
                },
                function(callback) {
                    debugLog("Disconnecting client");
                    client.disconnect(callback);
                },
                function(callback) {
                    // relax a little bit so that server can complete pending operations
                    setImmediate(callback);
                },
                function(callback) {
                    // relax a little bit so that server can complete pending operations
                    setImmediate(callback);
                }
            ],function(err) {

                debugLog("finally");
                server.currentChannelCount.should.equal(0);
                debugLog(" error : ", err);
                done();
            });

    });
});
