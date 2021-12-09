"use strict";
const fs = require("fs");
const should = require("should");

const { NodeId } = require("node-opcua-nodeid");

const { get_mini_nodeset_filename } = require("node-opcua-address-space/testHelpers");

const { OPCUAServer } = require("..");

const mini_nodeset_filename = get_mini_nodeset_filename();

fs.existsSync(mini_nodeset_filename).should.eql(true, " expecting " + mini_nodeset_filename + " to exist");

const port = 2022;
// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("OPCUAServer", () => {
    let server;
    beforeEach((done) => {
        const options = {
            port,
            nodeset_filename: [mini_nodeset_filename]
        };

        server = new OPCUAServer(options);
        server.start((err) => {
            done(err);
        });
    });
    afterEach((done) => {
        if (server) {
            server.shutdown(() => {
                server = null;
                done();
            });
        } else {
            server = null;
            done();
        }
    });

    it("should dismiss all existing sessions upon termination", (done) => {
        server.engine.currentSessionCount.should.equal(0);

        // let make sure that no session exists
        // (session and subscriptions )
        let session = server.createSession();

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

    it("server address space have a node matching session.nodeId", (done) => {
        server.engine.currentSessionCount.should.equal(0);

        // let make sure that no session exists
        // (session and subscriptions )
        const session = server.createSession();

        session.sessionName = "SessionNameGivenByClient";
        // activate session
        session.status = "active";

        session.nodeId.should.be.instanceOf(NodeId);

        //xx session.nodeId.identifierType.should.eql(NodeId.NodeIdType.GUID);

        const sessionNode = server.engine.addressSpace.findNode(session.nodeId);

        should(!!sessionNode).eql(true, " a session node must be found");

        sessionNode.nodeId.should.eql(session.nodeId);

        sessionNode.browseName.toString().should.eql("1:SessionNameGivenByClient");
        done();
    });
});

describe("OPCUAServer-2", () => {
    let server;

    before((done) => {
        fs.existsSync(mini_nodeset_filename).should.eql(true);

        const options = {
            port,
            nodeset_filename: [mini_nodeset_filename]
        };
        server = new OPCUAServer(options);
        server.start(done);
    });

    after((done) => {
        server.shutdown(() => {
            server = null;
            done();
        });
    });

    it("#rejectedSessionCount", () => {
        server.rejectedSessionCount.should.eql(server.engine.rejectedSessionCount);
    });

    it("#rejectedRequestsCount", () => {
        server.rejectedRequestsCount.should.eql(server.engine.rejectedRequestsCount);
    });

    it("#sessionAbortCount", () => {
        server.sessionAbortCount.should.eql(server.engine.sessionAbortCount);
    });

    it("#publishingIntervalCount", () => {
        server.publishingIntervalCount.should.eql(server.engine.publishingIntervalCount);
    });

    it("#buildInfo", () => {
        server.buildInfo.should.eql(server.engine.buildInfo);
    });
});
describe("OPCUAServer-3", () => {
    let server;
    before((done) => {
        server = new OPCUAServer();
        done();
    });

    it("checking IOPCUAServer properties before startup", () => {
        server.currentChannelCount.should.eql(0);
        server.rejectedSessionCount.should.eql(0);
        server.rejectedRequestsCount.should.eql(0);
        server.currentSubscriptionCount.should.eql(0);
        server.sessionAbortCount.should.eql(0);
        server.publishingIntervalCount.should.eql(0);
        server.currentSessionCount.should.eql(0);
        server.isAuditing.should.eql(false);
        should(server.getSession(NodeId.nullNodeId, true)).eql(null);
    });
});
