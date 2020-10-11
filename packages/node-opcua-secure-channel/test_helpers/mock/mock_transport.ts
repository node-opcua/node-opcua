// tslint:disable:no-console
import * as chalk from "chalk";
import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";
import { displayTraceFromThisProjectOnly, hexDump, make_debugLog } from "node-opcua-debug";
import { analyseExtensionObject } from "node-opcua-packet-analyzer";
import { GetEndpointsResponse } from "node-opcua-service-endpoints";
import { CloseSecureChannelResponse, OpenSecureChannelResponse } from "node-opcua-service-secure-channel";
import { ActivateSessionResponse, CreateSessionResponse } from "node-opcua-service-session";
import { AcknowledgeMessage } from "node-opcua-transport";
import { DirectTransport } from "node-opcua-transport/dist/test_helpers";

const debugLog = make_debugLog(__filename);

export const fakeAcknowledgeMessage = new AcknowledgeMessage({
    maxChunkCount: 600000,
    maxMessageSize: 100000,
    protocolVersion: 0,
    receiveBufferSize: 8192,
    sendBufferSize: 8192
});

export const fakeCloseSecureChannelResponse = new CloseSecureChannelResponse({});

export const fakeOpenSecureChannelResponse = new OpenSecureChannelResponse({
    serverProtocolVersion: 0,

    securityToken: {
        channelId: 23,
        createdAt: new Date(), // now
        revisedLifetime: 30000,
        tokenId: 1
    },
    serverNonce: Buffer.from("qwerty")
});

export const fakeGetEndpointsResponse = new GetEndpointsResponse({
    endpoints: [
        {
            endpointUrl: "fake://localhost:2033/SomeAddress"
        }
    ]
});

export const fakeCreateSessionResponse = new CreateSessionResponse({});
export const fakeActivateSessionResponse = new ActivateSessionResponse({});

export class MockServerTransport extends EventEmitter {
    private _replies: any;
    private _mockTransport: DirectTransport;
    private _counter: number;

    constructor(expectedReplies: any) {
        super();

        this._replies = expectedReplies;
        this._counter = 0;

        this._mockTransport = new DirectTransport();
        this._mockTransport.initialize(() => {
            console.log("initialized");
        });

        this._mockTransport.server.on("data", (data: Buffer) => {
            let reply = this._replies[this._counter];
            this._counter++;
            if (reply) {
                if (typeof reply === "function") {
                    reply = reply.call(this);
                    // console.log(" interpreting reply as a function" + reply);
                    if (!reply) {
                        return;
                    }
                }

                debugLog("\nFAKE SERVER RECEIVED");
                debugLog(hexDump(data));

                let replies = [];
                if (reply instanceof Buffer) {
                    replies.push(reply);
                } else {
                    replies = reply;
                }
                assert(replies.length >= 1, " expecting at least one reply " + JSON.stringify(reply));
                replies.forEach((reply1: any) => {
                    debugLog("\nFAKE SERVER SEND");
                    debugLog(chalk.red(hexDump(reply1)));
                    this._mockTransport.server.write(reply1);
                });
            } else {
                const msg = " MockServerTransport has no more packets to send to client to" + " emulate server responses.... ";
                console.log(chalk.red.bold(msg));
                console.log(chalk.blue.bold(hexDump(data)));

                displayTraceFromThisProjectOnly();
                analyseExtensionObject(data, 0, 0, {});

                this.emit("done");
            }
        });
    }
}
