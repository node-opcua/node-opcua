nodeopcua = require("../lib/nodeopcua");
OPCUAServer = require("../lib/opcua-server").OPCUAServer;
OPCUAClient = require("../lib/opcua-client").OPCUAClient;

var should = require("should");

describe("testing basic Client-Server communication",function() {

    it("should start a server and accept a connection",function(done){

        var server = new OPCUAServer();
        server.listen(8345);
        server.connected_client_count.should.equal(0);

        var client = new OPCUAClient();

        client.connect("localhost",8345, function callback(){

            server.connected_client_count.should.equal(1);

            process.nextTick(function() {
                client.disconnect(function() {
                    server.shutdown(function() {
                        done();
                    })
                })
            });
        });


    });

});

