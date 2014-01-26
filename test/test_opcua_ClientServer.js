var OPCUAServer = require("../lib/opcua-server").OPCUAServer;
var OPCUAClient = require("../lib/opcua-client").OPCUAClient;
var should = require("should");
var async = require("async");
var util = require("util");



var doDebug = false;
// doDebug = true;
function debugLog() {
    if (doDebug) {
        console.log.apply(console,arguments);
    }
}

describe("testing basic Client-Server communication",function() {

    it("should start a server and accept a connection",function(done){

        var server = new OPCUAServer();

        server.listen(8345);

        server.connected_client_count.should.equal(0);

        var client = new OPCUAClient();

        async.series([
            function(callback) {
                debugLog(" connect");
                client.connect("localhost",8345,callback);
            },
            function(callback) {
                server.connected_client_count.should.equal(1);
                callback();
            },
            function(callback) {
                debugLog(" disconnect");
                client.disconnect(callback);
            },
            function(callback) {
                server.shutdown(callback);
            }
        ],done);

    });

    it("Server should not accept connection, if protocol version is incompatible",function(done){

        var server = new OPCUAServer();
        server.listen(8346);

        var client = new OPCUAClient();
        client.protocolVersion = 55555; // set a invalid protocol version

        async.series([
            function(callback) {
                debugLog(" connect");
                client.connect("localhost",8345,callback);
            },
            function(callback) {
                server.shutdown(callback);
            }
        ],function(err) {

            debugLog(" error : ", err);
            server.shutdown(done);
        });

    });


});

