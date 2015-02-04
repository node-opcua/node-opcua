require("requirish")._(module);
var should  = require("should");


var empty_nodeset_filename = require("path").join(__dirname,"./fixtures/fixture_empty_nodeset2.xml");


var opcua = require("index");
var OPCUAServer = opcua.OPCUAServer;

describe('testing 2 servers on same port ',function(){

    var server1 = new OPCUAServer({ port: 12345 , nodeset_filename: empty_nodeset_filename });

    before(function(done){

        server1.start(function(err){
            done(err);
        });
    });
    after(function(done){
        server1.shutdown(done);
    });
    it("should fail to start a second server on a busy port ",function(done){

        var server2 = new OPCUAServer({ port: 12345,nodeset_filename: empty_nodeset_filename });

        server2.start(function(err){
            err.should.be.instanceOf(Error);
            done();
        });
    });
});