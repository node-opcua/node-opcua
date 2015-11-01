"use strict";
require("requirish")._(module);

var OPCUAServer = require("lib/server/opcua_server").OPCUAServer;

var should = require("should");
var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;


describe("OPCUAServer", function () {

    before(function () {
        resourceLeakDetector.start();
    });
    after(function () {
        resourceLeakDetector.stop();
    });

    var server = new OPCUAServer({});

    it("should dismiss all existing session upon termination", function (done) {

        server.engine.currentSessionCount.should.equal(0);

        // let make sure that no session exists
        // (session and subscriptions )
        var session = server.createSession();

        server.engine.currentSessionCount.should.equal(1);
        server.engine.cumulatedSessionCount.should.equal(1);


        server.shutdown(function () {
            session = null;
            server.engine.currentSessionCount.should.equal(0);
            server.engine.cumulatedSessionCount.should.equal(1);
            done();
        });

    });

    it("#rejectedSessionCount", function () {
        server.rejectedSessionCount.should.eql(server.engine.rejectedSessionCount);
    });

    it("#rejectedRequestsCount", function () {
        server.rejectedRequestsCount.should.eql(server.engine.rejectedRequestsCount);
    });

    it("#sessionAbortCount", function () {
        server.sessionAbortCount.should.eql(server.engine.sessionAbortCount);
    });

    it("#publishingIntervalCount", function () {
        server.publishingIntervalCount.should.eql(server.engine.publishingIntervalCount);
    });

    it("#buildInfo", function () {
        server.buildInfo.should.eql(server.engine.buildInfo);
    });



});
