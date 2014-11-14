
var OPCUAServer = require("../lib/server/opcua_server").OPCUAServer;
var should  = require("should");

describe('testing 2 servers on same port ',function(){

    var server1 = new OPCUAServer({ port: 12345 });

    before(function(done){

        server1.start(function(err){
            done(err);
        });
    });
    after(function(done){
        server1.shutdown(done);
    });
    it("should fail to start a second server on a busy port ",function(done){

        var server2 = new OPCUAServer({ port: 12345 });

        server2.start(function(err){
            err.should.be.instanceOf(Error);
            done();
        });
    });
});