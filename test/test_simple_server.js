
var OPCUAServer = require("../lib/server/opcua_server").OPCUAServer;
var should = require("should");
var opcua = require("../lib/nodeopcua");

describe("Testing a simple server from Server side",function(){


    it("should have at least one endpoint",function(){

        var server = new OPCUAServer();

        server.endpoints.length.should.be.greaterThan(0);

        var endpoint = server.endpoints[0];

        var e = opcua.parseEndpointUrl(endpoint.endpointDescription().endpointUrl);

        e.hostname.should.be.equal(require("os").hostname().toLowerCase());
        e.port.should.be.greaterThan(500);

    });


    it("should start and shutdown",function(done){

        var server = new OPCUAServer();

        server.start(function(){
            process.nextTick(function() {
                server.shutdown(function(){
                    done();
                });
            })
        })
    });

});