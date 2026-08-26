import { EventEmitter } from "node:events";

import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import type { ServerSecureChannelLayer } from "node-opcua-secure-channel";
import should from "should";

import { ServerEngine } from "../source";

/**
 * A secure channel can carry many sessions, and each attached session registers
 * its own "abort" listener on it. With the default ceiling of 10, ~9 concurrent
 * sessions on a single channel were enough to make node print
 * MaxListenersExceededWarning for a channel that was not leaking anything (#422).
 */
describe("ServerSession - abort listeners on a shared secure channel", () => {
    /** minimal stand-in exposing only what _attach_channel/_detach_channel touch */
    function makeFakeChannel(): ServerSecureChannelLayer {
        const channel = new EventEmitter();
        Object.assign(channel, { channelId: 1, sessionTokens: {} });
        return channel as unknown as ServerSecureChannelLayer;
    }

    it("does not warn when more than 10 sessions share one channel", async () => {
        const warnings: Error[] = [];
        const onWarning = (w: Error) => warnings.push(w);
        process.on("warning", onWarning);

        const engine = new ServerEngine({ applicationUri: "application:uri" });
        const channel = makeFakeChannel();
        const sessions = [];
        try {
            for (let i = 0; i < 15; i++) {
                const session = engine.createSession({ server: {} });
                // _attach_channel asserts on it; the server sets it at CreateSession time
                session.nonce = Buffer.alloc(32);
                session._attach_channel(channel);
                sessions.push(session);
            }
            // the "warning" event is delivered on the next tick
            await new Promise((resolve) => setImmediate(resolve));

            const maxListenerWarnings = warnings.filter((w) => w.name === "MaxListenersExceededWarning");
            maxListenerWarnings.length.should.eql(0, maxListenerWarnings.map((w) => w.message).join("\n"));
            channel.listenerCount("abort").should.eql(15);
        } finally {
            process.removeListener("warning", onWarning);
            for (const session of sessions) {
                session._detach_channel();
            }
            await engine.shutdown();
        }
    });

    it("brings the ceiling back down as sessions detach", async () => {
        const engine = new ServerEngine({ applicationUri: "application:uri" });
        const channel = makeFakeChannel();
        try {
            const session = engine.createSession({ server: {} });
            session.nonce = Buffer.alloc(32);
            session._attach_channel(channel);
            const attached = channel.getMaxListeners();

            session._detach_channel();
            channel.getMaxListeners().should.be.lessThan(attached);
            channel.listenerCount("abort").should.eql(0);
        } finally {
            await engine.shutdown();
        }
    });
});
