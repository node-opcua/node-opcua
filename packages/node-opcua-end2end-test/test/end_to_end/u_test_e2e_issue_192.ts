import "should";
import sinon from "sinon";
import { OPCUAClient } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

interface TestHarness { endpointUrl: string; server: any; [k: string]: any }

/**
 * Enhancement #192 - Server emits 'newChannel' on secure channel open and 'closeChannel' on close.
 */
export function t(test: TestHarness) {
    describe("Enhancement #192 channel open/close events", () => {
        it("emits newChannel and closeChannel once for a single client connect/disconnect", async () => {
            const server = test.server;
            if (!server) return;

            const spyNew = sinon.spy((channel: any) => {
                channel.remoteAddress.should.be.instanceof(String);
                channel.remotePort.should.be.instanceof(Number);
            });
            const spyClose = sinon.spy((channel: any) => {
                channel.remoteAddress.should.be.instanceof(String);
                channel.remotePort.should.be.instanceof(Number);
            });
            server.on("newChannel", spyNew);
            server.on("closeChannel", spyClose);

            const client = OPCUAClient.create({});
            await client.connect(test.endpointUrl);
            await client.disconnect();

            server.removeListener("newChannel", spyNew);
            server.removeListener("closeChannel", spyClose);

            spyNew.callCount.should.eql(1);
            spyClose.callCount.should.eql(1);
        });
    });
}
