/**
 * Reproduction test for infinite recursion bug in
 * ServerSecureChannelLayer.send_response
 *
 * When chunkSecureMessage returns a bad StatusCode (e.g. BadTcpMessageTooLarge),
 * send_response tries to send a ServiceFault instead by calling itself
 * recursively. If the ServiceFault also fails to chunk (same root cause), the
 * recursion never terminates: RangeError: Maximum call stack size exceeded.
 *
 * This test forces the chunker to reject every message by stubbing
 * MessageChunker.prototype.chunkSecureMessage *after* the secure channel
 * handshake, then calling send_response with a normal response.
 */

import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { GetEndpointsResponse } from "node-opcua-service-endpoints";
import { StatusCodes } from "node-opcua-status-code";
import { TransportPairDirect } from "node-opcua-transport/dist/test_helpers";
import * as fixtures from "node-opcua-transport/dist/test-fixtures";
import should from "should";
import {
    type Message,
    MessageChunker,
    MessageSecurityMode,
    SecurityPolicy,
    ServerSecureChannelLayer,
    type ServerSecureChannelParent
} from "../dist/source";
import type { Response } from "../dist/source/common";

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const waitUntilCondition = (predicate: () => boolean, timeout: number, message: string): Promise<void> => {
    const start = Date.now();
    return new Promise<void>((resolve, reject) => {
        const interval = setInterval(() => {
            if (predicate()) {
                clearInterval(interval);
                resolve();
            } else if (Date.now() - start > timeout) {
                clearInterval(interval);
                reject(new Error(`Timeout waiting for condition : ${message}`));
            }
        }, 100);
    });
};

describe("send_response infinite recursion bug", function (this: Mocha.Suite) {
    this.timeout(30000);

    it("REPRO-#1 should not overflow the stack when " + "chunkSecureMessage consistently fails", async () => {
        const transportPair = new TransportPairDirect();

        const serverSecureChannel = new ServerSecureChannelLayer({
            parent: null as unknown as ServerSecureChannelParent
        });
        serverSecureChannel.setSecurity(MessageSecurityMode.None, SecurityPolicy.None);
        serverSecureChannel.timeout = 50;
        serverSecureChannel.channelId = 8;

        // ──── Set up secure channel to "open" state ────

        const initPromise = new Promise<void>((resolve, reject) => {
            serverSecureChannel.init(transportPair.server, (err) => (err ? reject(err) : resolve()));
        });
        await pause(10);
        const { helloMessage1 } = fixtures;
        transportPair.client.write(helloMessage1);
        await initPromise;

        const { openChannelRequest1 } = fixtures;
        transportPair.client.write(openChannelRequest1);

        await waitUntilCondition(() => serverSecureChannel.isOpened, 2000, "expecting ServerSecureChannel to enter IsOpened state");

        // ──── Wait for a "message" event so we have a valid Message ────

        const messagePromise = new Promise<Message>((resolve) => {
            serverSecureChannel.once("message", resolve);
        });

        const { getEndpointsRequest1 } = fixtures;
        getEndpointsRequest1.writeInt16LE(serverSecureChannel.channelId, 8);
        transportPair.client.write(getEndpointsRequest1);
        const message = await messagePromise;

        // ──── Monkey-patch the internal chunker so chunkSecureMessage
        //      always returns BadTcpMessageTooLarge ────
        //
        // This simulates conditions like missing derived keys in a
        // secured channel (the production crash scenario) where every
        // call to chunkSecureMessage fails systematically.
        //
        // We also cap the recursion depth to detect the bug without
        // actually crashing with a stack overflow.

        let sendResponseCallCount = 0;
        const maxCallsBeforeAbort = 10;
        const originalSendResponse = serverSecureChannel.send_response.bind(serverSecureChannel);

        serverSecureChannel.send_response = (
            msgType: string,
            response: Response,
            msg: Message,
            callback?: (err?: Error) => void
        ) => {
            sendResponseCallCount++;
            if (sendResponseCallCount > maxCallsBeforeAbort) {
                // Detected infinite recursion — stop to prevent crash.
                callback?.(new Error(`Infinite recursion detected: send_response called ${sendResponseCallCount} times`));
                return;
            }
            originalSendResponse(msgType, response, msg, callback);
        };

        // Stub chunkSecureMessage to always return a bad status
        const origChunkSecureMessage = MessageChunker.prototype.chunkSecureMessage;

        MessageChunker.prototype.chunkSecureMessage = () => StatusCodes.BadTcpMessageTooLarge;

        // ──── Trigger send_response, which should now fail ────
        const response = new GetEndpointsResponse();

        let sendResponseError: Error | undefined;
        await new Promise<void>((resolve) => {
            serverSecureChannel.send_response("MSG", response, message, (err?: Error) => {
                sendResponseError = err;
                resolve();
            });
        });

        // ──── Restore the original chunkSecureMessage ────
        MessageChunker.prototype.chunkSecureMessage = origChunkSecureMessage;

        // ──── Assertions ────
        console.log(`send_response was called ${sendResponseCallCount} times`);

        // With the bug:  sendResponseCallCount > maxCallsBeforeAbort
        // With the fix:  sendResponseCallCount should be exactly 2
        //   (1st call for original response, 2nd for ServiceFault,
        //    then it stops)
        sendResponseCallCount.should.be.belowOrEqual(
            3,
            "send_response should not recurse more than 2-3 times, " +
                `but was called ${sendResponseCallCount} times ` +
                "— infinite recursion bug!"
        );

        should.exist(sendResponseError, "send_response should report an error when the " + "ServiceFault itself cannot be sent");

        // ──── Cleanup ────
        await new Promise<void>((resolve) => {
            serverSecureChannel.close(() => {
                serverSecureChannel.dispose();
                resolve();
            });
        });
        transportPair.shutdown(() => {
            /** */
        });
    });
});
