// http://opcfoundation.org/UA/SecurityPolicy#Basic256


var opcua = require("../");
var should = require("should");
var assert = require('better-assert');
var async = require("async");
var util = require("util");

var utils = opcua.utils;

var OPCUAServer = opcua.OPCUAServer;
var OPCUAClient = opcua.OPCUAClient;
var StatusCodes = opcua.StatusCodes;
var Variant =  opcua.Variant ;
var DataType = opcua.DataType;
var DataValue = opcua.DataValue;
var SecurityPolicy = opcua.SecurityPolicy;

var BrowseDirection = opcua.browse_service.BrowseDirection;
var debugLog  = opcua.utils.make_debugLog(__filename);


var _ = require("underscore");

var port = 2000;

var build_server_with_temperature_device = require("./helpers/build_server_with_temperature_device").build_server_with_temperature_device;


function perform_client_operations(server,client,endpointUrl,done) {

    var g_session ;
    async.series([
        function(callback) {
            debugLog(" connect");
            client.connect(endpointUrl,function(err){
                debugLog(" Error =".yellow.bold,err);
                callback(err);
            });
            client.on("close",function(err){
                console.log("ERR",err);
                callback(new Error("cannot connect"));
            })
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
        debugLog(" error : ", err);
        done(err);
    });

}

describe("testing basic Client-Server communication",function() {

    var server , client, temperatureVariableId, endpointUrl,serverCertificate;

    before(function (done) {
        // Given a server that have a signed end point
        server = build_server_with_temperature_device({ port: port}, function () {
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            serverCertificate = server.endpoints[0].endpointDescriptions()[0].serverCertificate;
            temperatureVariableId = server.temperatureVariableId;

            done();
        });
    });
    after(function (done) {
        server.currentChannelCount.should.equal(0);
        server.shutdown(done);
    });

    xit("a client shall be able to establish a SIGNED connection with a server", function (done) {


        should(serverCertificate).not.equal(null);

        server.currentChannelCount.should.equal(0);
        var options ={
            securityMode:       opcua.MessageSecurityMode.SIGN,
            securityPolicy:    SecurityPolicy.Basic128Rsa15,
            serverCertificate: serverCertificate
        };
        client = new OPCUAClient(options);
        perform_client_operations(server,client,endpointUrl,function(err) {
            done();
        });

    });

    it("a client shall be able to establish a SIGN&ENCRYPT connection with a server ", function (done) {


        should(serverCertificate).not.equal(null);
        server.currentChannelCount.should.equal(0);

        var options ={
            securityMode: opcua.MessageSecurityMode.SIGNANDENCRYPT,
            securityPolicy:    SecurityPolicy.Basic128Rsa15,
            serverCertificate: serverCertificate
        };
        client = new OPCUAClient(options);
        perform_client_operations(server,client,endpointUrl,function(err) {
            done();
        });

    });});
