
var DirectTransport = require("../../lib/transport/fake_socket").DirectTransport;
var should = require("should");

describe("A Fake Socket to emulate client/server communication in tests",function(){

    var transport = new DirectTransport();

    beforeEach(function() {

    });
    it("server side should receive data send by the client only",function(done){

        transport.client.on("data",function(data){
            data.should.equal("Some Data");
            done();
        });
        transport.server.write("Some Data");
    });

    it("client side should receive data send by the server only",function(done){
        transport.server.on("data",function(data){
            data.should.equal("Some Data");
            done();
        });
        transport.client.write("Some Data");
    });

});