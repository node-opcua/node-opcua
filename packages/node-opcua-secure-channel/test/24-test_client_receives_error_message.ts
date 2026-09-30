import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { GetEndpointsRequest } from "node-opcua-service-endpoints";
import { StatusCodes } from "node-opcua-status-code";
import { packTcpMessage, TCPErrorMessage, TCPErrorMessageReceivedError } from "node-opcua-transport";
import { openSecureChannelResponse1 } from "node-opcua-transport/testFixtures.js";
import should from "should";
import sinon from "sinon";

import { ClientSecureChannelLayer } from "../dist/source/index.js";
import { fakeAcknowledgeMessage, MockServerTransport } from "../dist/test_helpers/index.js";

/**
 * OPC 10000-6 §7.1.5: "When the Client receives an Error Message it reports the error to the
 * application and closes the TransportConnection gracefully."
 * The client used to drop the ERR and report the socket close that followed it instead
 * ("socket has been disconnected by third party"), so the StatusCode never reached the caller.
 */

// the 16 bytes a server sent when it did not trust the client certificate:
// "ERRF", length 16, Error = BadSecurityChecksFailed, Reason = null string
function errBadSecurityChecksFailedWithNullReason(): Buffer {
    const chunk = Buffer.alloc(16);
    chunk.write("ERRF", 0, "ascii");
    chunk.writeUInt32LE(16, 4);
    chunk.writeUInt32LE(StatusCodes.BadSecurityChecksFailed.value, 8);
    chunk.writeInt32LE(-1, 12);
    return chunk;
}

describe("ClientSecureChannelLayer receiving an Error Message (ERR)", function (this: Mocha.Context) {
    this.timeout(Math.max(20 * 1000, this.timeout()));

    it("CEM-1 create() fails with the StatusCode of an ERR sent in reply to OpenSecureChannel, then FIN", async () => {
        const mock = new MockServerTransport([
            // HEL => ACK
            packTcpMessage("ACK", fakeAcknowledgeMessage),
            // OPN => ERR, then the server closes its side
            function (this: MockServerTransport) {
                this.mockTransport.server.write(errBadSecurityChecksFailedWithNullReason());
                this.mockTransport.server.end();
                return undefined;
            }
        ]);

        const secureChannel = new ClientSecureChannelLayer({});
        const closeSpy = sinon.spy();
        secureChannel.on("close", closeSpy);

        const err = await new Promise<Error | undefined>((resolve) => {
            secureChannel.create("fake://localhost:2033/SomeAddress", (err) => resolve(err));
        });
        mock.removeAllListeners();

        should(err).be.instanceOf(TCPErrorMessageReceivedError);
        const errorMessage = err as TCPErrorMessageReceivedError;
        should(errorMessage.statusCode).eql(StatusCodes.BadSecurityChecksFailed);
        should(errorMessage.reason).eql(null);
        should(errorMessage.message).match(/BadSecurityChecksFailed \(0x80130000\)/);
        should(errorMessage.message).not.match(/third party/);

        should(closeSpy.callCount).eql(1);
        should(closeSpy.getCall(0).args[0]).equal(err);
    });

    it("CEM-2 a transaction on an open channel fails with the ERR, and the client closes the connection itself", async () => {
        const mock = new MockServerTransport([
            // HEL => ACK
            packTcpMessage("ACK", fakeAcknowledgeMessage),
            // OPN => OpenSecureChannelResponse
            openSecureChannelResponse1,
            // MSG (GetEndpoints) => ERR, and the server keeps its side open
            packTcpMessage(
                "ERR",
                new TCPErrorMessage({ statusCode: StatusCodes.BadTcpInternalError, reason: "something went wrong" })
            )
        ]);

        const secureChannel = new ClientSecureChannelLayer({});
        await new Promise<void>((resolve, reject) => {
            secureChannel.create("fake://localhost:2033/SomeAddress", (err) => (err ? reject(err) : resolve()));
        });

        const closeEvent = new Promise<Error | null | undefined>((resolve) => {
            secureChannel.once("close", (err?: Error | null) => resolve(err));
        });
        const err = await new Promise<Error | null>((resolve) => {
            secureChannel.performMessageTransaction(new GetEndpointsRequest({}), (err) => resolve(err));
        });
        const closeError = await closeEvent;
        mock.removeAllListeners();

        should(err).be.instanceOf(TCPErrorMessageReceivedError);
        should((err as TCPErrorMessageReceivedError).statusCode).eql(StatusCodes.BadTcpInternalError);
        should((err as TCPErrorMessageReceivedError).reason).eql("something went wrong");
        should((err as TCPErrorMessageReceivedError).message).match(/BadTcpInternalError.*something went wrong/);
        should(closeError).equal(err);
    });
});
