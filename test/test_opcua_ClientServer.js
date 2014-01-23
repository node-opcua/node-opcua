var OPCUAServer = require("../lib/opcua-server").OPCUAServer;
var OPCUAClient = require("../lib/opcua-client").OPCUAClient;
var should = require("should");
var async = require("async");

describe("testing basic Client-Server communication",function() {

    it("should start a server and accept a connection",function(done){

        var server = new OPCUAServer();

        server.listen(8345);

        server.connected_client_count.should.equal(0);

        var client = new OPCUAClient();

        async.series([
            function(callback) {
                client.connect("localhost",8345,callback);
            },
            function(callback) {
                server.connected_client_count.should.equal(1);
                callback();
            },
            function(callback) {
                client.disconnect(callback);
            },
            function(callback) {
                server.shutdown(callback);
            }
        ],done);

    });

});

