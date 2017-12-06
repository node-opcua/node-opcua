"use strict";
var should = require("should");
var fs = require("fs");

var OPCUAServer = require("../src/opcua_server").OPCUAServer;


var NodeId = require("node-opcua-nodeid").NodeId;

var mini_nodeset_filename =require("../src/server_engine").mini_nodeset_filename;
fs.existsSync(mini_nodeset_filename).should.eql(true);


var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("OPCUAServer", function () {


    var server;

    beforeEach(function (done) {
        var options = {
            port: 2000,
            nodeset_filename: [mini_nodeset_filename]
        };

        server = new OPCUAServer(options);
        server.start(function (err) {
            done(err);
        });
    });
    afterEach(function (done) {
        if (server) {
            server.shutdown(function () {
                server = null;
                done();
            });

        } else {
            server = null;
            done();
        }
    });

    it("should dismiss all existing session upon termination", function (done) {

        server.engine.currentSessionCount.should.equal(0);

        // let make sure that no session exists
        // (session and subscriptions )
        var session = server.createSession();

        server.engine.currentSessionCount.should.equal(1);
        server.engine.cumulatedSessionCount.should.equal(1);


        server.shutdown(function () {
            server.engine.currentSessionCount.should.equal(0);
            server.engine.cumulatedSessionCount.should.equal(1);
            server = null;
            session = null;
            done();
        });

    });

    it("server address space have a node matching session.nodeId", function (done) {


        server.engine.currentSessionCount.should.equal(0);

        // let make sure that no session exists
        // (session and subscriptions )
        var session = server.createSession();

        session.sessionName = "SessionNameGivenByClient";
        // activate session
        session.status = "active";

        session.nodeId.should.be.instanceOf(NodeId);

        //xx session.nodeId.identifierType.should.eql(NodeId.NodeIdType.GUID);

        var sessionNode = server.engine.addressSpace.findNode(session.nodeId);

        should(!!sessionNode).eql(true," a session node must be found");

        sessionNode.nodeId.should.eql(session.nodeId);

        sessionNode.browseName.toString().should.eql("SessionNameGivenByClient");
        done();

    });
});

describe("OPCUAServer-2",function() {


    var server ;
    before(function() {

        fs.existsSync(mini_nodeset_filename).should.eql(true);

        var options = {
            port: 2000,
            nodeset_filename: [mini_nodeset_filename]
        };
        server = new OPCUAServer(options);
    });
    after(function (done) {
        server.shutdown(function () {
            server = null;
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


