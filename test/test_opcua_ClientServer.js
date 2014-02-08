var OPCUAServer = require("../lib/opcua-server").OPCUAServer;
var OPCUAClient = require("../lib/opcua-client").OPCUAClient;
var should = require("should");
var async = require("async");
var util = require("util");
var opcua = require("../lib/nodeopcua");

var debugLog  = require("../lib/utils").make_debugLog(__filename);


function is_valid_endpointUrl(endpointUrl) {
    var e = opcua.parseEndpointUrl(endpointUrl);
    if (e.hasOwnProperty("hostname")) {
        return true;
    }
    return false;
}

describe("testing basic Client-Server communication",function() {

    var server , client;
    var endpointUrl ;
    beforeEach(function(done){

        server = new OPCUAServer();
        // we will connect to first server end point
        endpointUrl = server.endpoints[0].endpointDescription().endpointUrl;
        debugLog("endpointUrl",endpointUrl);
        is_valid_endpointUrl(endpointUrl).should.equal(true);

        server.start(function() {
            done();
        });
        client = new OPCUAClient();


    });
    afterEach(function(done){

        server.shutdown(function() {
            done();
        });

    });

    it("should start a server and accept a connection",function(done){

        server.connected_client_count.should.equal(0);

        client.protocolVersion = 1;

        async.series([
            function(callback) {
                client.connect(endpointUrl,callback);
            },
            function(callback) {
                client.disconnect(callback);
            },
            function(callback) {
                server.shutdown(callback);
            }
        ],done);

    });

    it("Server should not accept connection, if protocol version is incompatible",function(done){

        client.protocolVersion = 55555; // set a invalid protocol version
        server.connected_client_count.should.equal(0);

        async.series([
            function(callback) {
                debugLog(" connect");
                client.connect(endpointUrl,function(err){

                    debugLog(" Error =".yellow.bold,err);
                    callback(err);
                });
            },
            function(callback) {
                server.shutdown(callback);
            }
        ],function(err) {
            server.connected_client_count.should.equal(0);
            debugLog(" error : ", err);
            server.shutdown(done);
        });

    });

    it("Client shall be able to create a session with a anonymous token",function(done){

        server.connected_client_count.should.equal(0);

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
            }
        ],function(err) {

            debugLog("finally");
            server.connected_client_count.should.equal(0);
            debugLog(" error : ", err);
            done();
        });

    });
});





