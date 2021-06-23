const should = require("should");
const sinon = require("sinon");

const { OPCUAClient } = require("node-opcua");

const { make_warningLog } = require("node-opcua-debug");

const warningLog = make_warningLog("TEST");

async function pause(ms) {
    return await new Promise((resolve)=>setTimeout(resolve,ms));
}

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
module.exports = function(test) {


    describe("ZZZA Testing timeout on session ", function() {

        it("An opened session will eventually time out on server side if the client doesn't make transactions", async () => {

            const endpointUrl = test.endpointUrl;
            // Given  client connect to a server a
            // Given that the client open a session.
            // Given that the client does nothing
            const client = OPCUAClient.create({
                keepSessionAlive: false,
            });

            // set a very short sessionTimeout
            client.requestedSessionTimeout = 2000;

            await client.connect(endpointUrl);
            const session = await client.createSession();

            await pause(client.requestedSessionTimeout * 2);

            await session.close();


            await client.disconnect();

            await pause(100);
            
            if (test.server) {
                test.server.engine.currentSessionCount.should.eql(0);
            }

        });

        it("An opened session will not time out on server side if the client has keepSessionAlive = true 1/2", async () => {

            const client = OPCUAClient.create({
                keepSessionAlive: true
            });

            const connection_lost_spy = sinon.spy();
            client.on("connection_lost", connection_lost_spy);

            const endpointUrl = test.endpointUrl;



            await client.connect(endpointUrl);
            // set a very short sessionTimeout ( > 500 though)
            client.requestedSessionTimeout = 600;


            // create a session using client1
            const session = await client.createSession();
            session.timeout.should.eql(600);

            const keepalive_spy = sinon.spy();
            session.on("keepalive", keepalive_spy);
            session.on("keepalive", () => warningLog("keepalive"));
            // let check that keep alive manager is active and as a checkInterval
            // which is below session Timeout
            session._keepAliveManager.checkInterval.should.eql(400);

            // now wait a little while
            await pause(2000);

            await session.close();
            keepalive_spy.callCount.should.be.greaterThan(2);

            await client.disconnect();
            connection_lost_spy.callCount.should.eql(0);
        });

        it("An opened session will not time-out on server side if the client has keepSessionAlive = true 2/2", async () => {

            const client = OPCUAClient.create({
                keepSessionAlive: true
            });

            const connection_lost_spy = sinon.spy();
            client.on("connection_lost", connection_lost_spy);

            const endpointUrl = test.endpointUrl;

            const keepalive_spy = sinon.spy();

            await client.connect(endpointUrl);

            // set a very short sessionTimeout
            client.requestedSessionTimeout = 1200;

            //xx warningLog("requestedSessionTimeout = ", client1.requestedSessionTimeout);

            const session = await client.createSession();
            warningLog("adjusted session timeout =", session.timeout);
            session.timeout.should.eql(client.requestedSessionTimeout);

            // let check that keep alive manager is active and as a checkInterval
            // which is below session Timeout
            session._keepAliveManager.checkInterval.should.eql(800);

            session.on("keepalive", keepalive_spy);
            session.on("keepalive", () => {
                warningLog("What's going here ? We should not receive KEEPALIVE " +
                    " as client is regularly communicating with server");
            });

            let dataValue = await session.read({ nodeId: "ns=1;i=54" });
            await pause(100);
            await session.read({ nodeId: "ns=1;i=54" });
            await pause(100);
            await session.read({ nodeId: "ns=1;i=54" });
            await pause(100);
            await session.read({ nodeId: "ns=1;i=54" });
            await pause(100);
            await session.read({ nodeId: "ns=1;i=54" });
            await pause(100);
            await session.read({ nodeId: "ns=1;i=54" });
            await pause(100);
            await session.read({ nodeId: "ns=1;i=54" });
            await pause(100);
            await session.read({ nodeId: "ns=1;i=54" });
            await pause(100);
            await session.read({ nodeId: "ns=1;i=54" });
            await pause(100);
            await session.read({ nodeId: "ns=1;i=54" });
            await pause(100);
            await session.read({ nodeId: "ns=1;i=54" });
            await pause(100);

            await session.close();
            // client should not have send keepalive, as  normal transactions happens between
            // client and server
            keepalive_spy.callCount.should.be.eql(0);
            await client.disconnect();
            connection_lost_spy.callCount.should.eql(0);
        });
    });
}




