var OPCUAServer = require("../lib/opcua-server").OPCUAServer;
var OPCUAClient = require("../lib/opcua-client").OPCUAClient;
var should = require("should");
var async = require("async");
var util = require("util");

var doDebug  = require("../lib/utils").should_debug(__filename);
function debugLog() {
    if (doDebug) {
        console.log.apply(console,arguments);
    }
}

describe("testing basic Client-Server communication",function() {

    var server , client;
    beforeEach(function(){

        server = new OPCUAServer();
        server.listen(8345);

        client = new OPCUAClient();

    });
    afterEach(function(done){

        client.disconnect(function(){
            server.shutdown(done);
        });

    });

    it("should start a server and accept a connection",function(done){


        server.connected_client_count.should.equal(0);

        client.protocolVersion = 1;

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

