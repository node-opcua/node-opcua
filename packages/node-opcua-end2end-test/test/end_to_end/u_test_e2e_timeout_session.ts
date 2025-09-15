import  "should";
import sinon from "sinon";
import { ClientSession, OPCUAClient } from "node-opcua";
import { make_warningLog } from "node-opcua-debug";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { waitUntilCondition } from "../../test_helpers/utils";
import { ClientSessionKeepAliveManager } from "node-opcua-client/dist/client_session_keepalive_manager";

const warningLog = make_warningLog("TEST");

const pause = (ms: number) => new Promise<void>((resolve)=>setTimeout(resolve,ms));

type OPCUAClientEx = OPCUAClient & { requestedSessionTimeout: number };
type ClientSessionEx = ClientSession & {
    _keepAliveManager: ClientSessionKeepAliveManager;
}; 

export function t(test: any) {

    describe("ZZZA Testing timeout on session ", function() {

        it("An opened session will eventually time out on server side if the client doesn't make transactions", async () => {
            const endpointUrl = test.endpointUrl;
            const requestedSessionTimeout = 2000;
            const client = OPCUAClient.create({
                keepSessionAlive: false,
                requestedSessionTimeout
            }) as OPCUAClientEx;
            let session: ClientSession | undefined;
            try {
                await client.connect(endpointUrl);
                session = await client.createSession();
                // server may revise, accept within 50%..150% of requested
                (session as any).timeout.should.be.within(requestedSessionTimeout * 0.5, requestedSessionTimeout * 1.5);
                // wait a bit longer than requested to let server timeout the session
                await pause(requestedSessionTimeout + 1000);
                // Attempt to close (may already be timed out)
                try {
                    await session.close();
                } catch (err: any) {
                    if (!/BadSessionIdInvalid/.test(err.message)) {
                        throw err;
                    }
                }
            } finally {
                await client.disconnect().catch(()=>undefined);
            }
            if (test.server) {
                await waitUntilCondition(()=>test.server.engine.currentSessionCount === 0, 10 * 1000);
            }
        });

        it("An opened session will not time out on server side if the client has keepSessionAlive = true 1/2", async () => {
            const requestedSessionTimeout = 600; // (>500)
            const client = OPCUAClient.create({
                keepSessionAlive: true,
                requestedSessionTimeout
            }) as OPCUAClientEx;
            const connection_lost_spy = sinon.spy();
            client.on("connection_lost", connection_lost_spy);
            const endpointUrl = test.endpointUrl;
            await client.connect(endpointUrl);
            const session = await client.createSession() as ClientSessionEx;
            // Allow some tolerance
            session.timeout.should.be.within(requestedSessionTimeout * 0.8, requestedSessionTimeout * 1.2);
            const keepalive_spy = sinon.spy();
            session.on("keepalive", keepalive_spy);
            session.on("keepalive", () => warningLog("keepalive"));
            // checkInterval should be less than timeout but not too small (> 50% of timeout)
            session._keepAliveManager.checkInterval.should.be.within(session.timeout * 0.5, session.timeout * 0.85);
            await pause(2000); // enough to get several keepalives
            await session.close();
            keepalive_spy.callCount.should.be.greaterThan(2);
            await client.disconnect();
            connection_lost_spy.callCount.should.eql(0);
        });

        it("An opened session will not time-out on server side if the client has keepSessionAlive = true 2/2", async () => {
            const requestedSessionTimeout = 1200;
            const client = OPCUAClient.create({
                keepSessionAlive: true,
                requestedSessionTimeout
            }) as OPCUAClientEx;
            const connection_lost_spy = sinon.spy();
            client.on("connection_lost", connection_lost_spy);
            const endpointUrl = test.endpointUrl;
            const keepalive_spy = sinon.spy();
            await client.connect(endpointUrl);
            const session = await client.createSession() as ClientSessionEx;
            warningLog("adjusted session timeout =", session.timeout);
            session.timeout.should.be.within(requestedSessionTimeout * 0.8, requestedSessionTimeout * 1.2);
            session._keepAliveManager.checkInterval.should.be.within(session.timeout * 0.5, session.timeout * 0.85);
            session.on("keepalive", keepalive_spy);
            session.on("keepalive", () => {
                warningLog("Unexpected KEEPALIVE while client is performing regular transactions");
            });
            const nodeId = "ns=1;i=54";
            for (let i = 0; i < 11; i++) {
                await session.read({ nodeId });
                await pause(100);
            }
            await session.close();
            // regular communication should avoid keepalive emission
            keepalive_spy.callCount.should.eql(0);
            await client.disconnect();
            connection_lost_spy.callCount.should.eql(0);
        });
    });
}




