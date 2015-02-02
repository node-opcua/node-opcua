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


describe("testing the server ability to deny client session request (server with maxAllowedSessionNumber = 1)",function(){


    var server = new OPCUAServer({
        port: 6789,
        maxAllowedSessionNumber: 1
    });

    var client1 =  new OPCUAClient();
    var client2 =  new OPCUAClient();

    var endpointUrl;
    before(function(done){
        server.start(function(){
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            done();
        });

    });

    after(function(done){

        async.series([
            function(callback) {    client2.disconnect(callback);      },
            function(callback) {    client1.disconnect(callback);      },
            function(callback) {    server.shutdown(callback);         }
        ],done);
    });

    it("should accept only one session at a time",function(done) {

        server.currentChannelCount.should.eql(0);

        async.series([
            // given that client1 is connected, and have a session
            function(callback) {    client1.connect(endpointUrl,callback);      },
            function(callback) {    client1.createSession(callback);            },


            function(callback) {    client2.connect(endpointUrl,callback);      },
            //  when client2 try to create a session
            function(callback) {    client2.createSession(function(err) {
            // it should failed
                                        should(err).be.instanceOf(Error);
                                        console.log("err = ",err.message);
                                        callback(null);
                                     });
            },


            // now if client1 disconnect ...
            function(callback) {    client1.disconnect(callback);      },
            // it should be possible to connect client 2
            function(callback) {    client2.createSession(callback);       }
        ],done);

    });


});
