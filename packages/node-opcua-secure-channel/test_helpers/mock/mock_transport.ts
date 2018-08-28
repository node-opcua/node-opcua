import * as _ from "underscore";
import { assert } from "node-opcua-assert";
import { hexDump, make_debugLog, display_trace_from_this_projet_only } from "node-opcua-debug";
import { DirectTransport } from "node-opcua-transport/dist/test_helpers";
import { analyseExtensionObject } from "node-opcua-packet-analyzer";
import chalk from "chalk";
import { CloseSecureChannelResponse, OpenSecureChannelResponse } from "node-opcua-service-secure-channel";
import { CreateSessionResponse, ActivateSessionResponse } from "node-opcua-service-session";
import { AcknowledgeMessage } from "node-opcua-transport";
import { GetEndpointsResponse } from "node-opcua-service-endpoints";
import { EventEmitter } from "events";

const debugLog = make_debugLog(__filename);

export const fakeAcknowledgeMessage = new AcknowledgeMessage({
    protocolVersion: 0,
    receiveBufferSize: 8192,
    sendBufferSize: 8192,
    maxMessageSize: 100000,
    maxChunkCount: 600000
});

export const fakeCloseSecureChannelResponse = new CloseSecureChannelResponse({});


export const fakeOpenSecureChannelResponse = new OpenSecureChannelResponse({
    serverProtocolVersion: 0,
    securityToken: {
        channelId: 23,
        tokenId: 1,
        createdAt: new Date(), // now
        revisedLifetime: 30000
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

                if (_.isFunction(reply)) {
                    reply = reply.call(this);
                    // console.log(" interpreting reply as a function" + reply);
                    if (!reply) {
                        return;
                    }
                }

                debugLog("\nFAKE SERVER RECEIVED");
                debugLog(hexDump(data).blue);

                let replies = [];
                if (reply instanceof Buffer) {
                    replies.push(reply);
                } else {
                    replies = reply;
                }
                assert(replies.length >= 1, " expecting at least one reply " + JSON.stringify(reply));
                replies.forEach((reply: any) => {
                    debugLog("\nFAKE SERVER SEND");
                    debugLog(hexDump(reply).red);
                    this._mockTransport.server.write(reply);
                });

            } else {
                const msg = " MockServerTransport has no more packets to send to client to emulate server responses.... ";
                console.log(chalk.red.bold(msg));
                console.log(chalk.blue.bold(hexDump(data)));

                display_trace_from_this_projet_only();
                analyseExtensionObject(data, 0, 0, {});

                this.emit("done");
            }
        });
    }

}

