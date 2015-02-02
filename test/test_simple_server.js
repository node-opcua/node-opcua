require("requirish")._(module);

var should = require("should");
var opcua = require(".");
var async = require("async");
var OPCUAServer = opcua.OPCUAServer;
var OPCUAClient = opcua.OPCUAClient;

describe("Testing a simple server from Server side",function(){


    it("should have at least one endpoint",function(){

        var server = new OPCUAServer({   port: 6789 });

        server.endpoints.length.should.be.greaterThan(0);

        var endPoint = server.endpoints[0];

        var e = opcua.parseEndpointUrl(endPoint.endpointDescriptions()[0].endpointUrl);

        var expected_hostname = require("os").hostname().toLowerCase();
        e.hostname.should.be.match(new RegExp(expected_hostname));

        e.port.should.be.greaterThan(500);

    });


    it("should start and shutdown",function(done){

        var server = new OPCUAServer({   port: 6789 });

        server.start(function(){
            process.nextTick(function() {
                server.shutdown(function(){
                    done();
                });
            })
        })
    });

});


