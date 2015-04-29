require("requirish")._(module);

var OPCUAServer = require("lib/server/opcua_server").OPCUAServer;

var should = require("should");
var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;



describe("OPCUAServer",function() {

    before(function (done) {
        resourceLeakDetector.start();
        done();
    });
    after(function () {
        resourceLeakDetector.stop();
    });

    it("should dismiss all existing session upon termination",function(done){

        var server = new OPCUAServer({});
        server.engine.currentSessionCount.should.equal(0);

        // let make sure that no session exists
        // (session and subscriptions )
        var session = server.createSession();

        server.engine.currentSessionCount.should.equal(1);
        server.engine.cumulatedSessionCount.should.equal(1);


        server.shutdown(function(){
            session = null;
            server.engine.currentSessionCount.should.equal(0);
            server.engine.cumulatedSessionCount.should.equal(1);
            done();
        });

    });
});
