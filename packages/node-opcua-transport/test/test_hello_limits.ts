/**
 * The limits a server adopts from a client's Hello.
 *
 * MaxMessageSize in the Hello is the largest response the *client* is willing to
 * receive (OPC 10000-6 7.1.2.3). It is a ceiling on what the server may send, so
 * a server that raises it announces - and then sends - messages the client has
 * already said it cannot accept. The client rejects them, which surfaces as a
 * transport error on a service call whose own result was Good.
 */
import "should";

import { adjustLimitsWithParameters } from "../source/server_tcp_transport.js";

const params = {
    minBufferSize: 8192,
    maxBufferSize: 8 * 64 * 1024,
    minMaxMessageSize: 128 * 1024,
    defaultMaxMessageSize: 16 * 1024 * 1024,
    maxMaxMessageSize: 128 * 1024 * 1024,
    minMaxChunkCount: 1,
    defaultMaxChunkCount: Math.ceil((128 * 1024 * 1024) / (8 * 64 * 1024)),
    maxMaxChunkCount: 9000
};

const hello = (maxMessageSize: number) => ({
    receiveBufferSize: 64 * 1024,
    sendBufferSize: 64 * 1024,
    maxMessageSize,
    maxChunkCount: 0
});

describe("HL - the limits adopted from a client's Hello", () => {
    it("HL-1 never raises a MaxMessageSize the client asked for", () => {
        // 64 kB is below minMaxMessageSize (128 kB): the floor must not apply to
        // a client-supplied ceiling, or the server sends twice what was allowed
        const limits = adjustLimitsWithParameters(hello(64 * 1024), params);
        limits.maxMessageSize.should.be.belowOrEqual(
            64 * 1024,
            `the client allowed 65536 bytes but the server adopted ${limits.maxMessageSize}`
        );
    });

    it("HL-2 lowers a MaxMessageSize beyond what the server can manage", () => {
        const limits = adjustLimitsWithParameters(hello(512 * 1024 * 1024), params);
        limits.maxMessageSize.should.eql(params.maxMaxMessageSize);
    });

    it("HL-3 uses its own default when the client announces no limit", () => {
        // zero means "no limit" on the wire, and is the one case where the
        // server's own floor and default are the right answer
        const limits = adjustLimitsWithParameters(hello(0), params);
        limits.maxMessageSize.should.eql(params.defaultMaxMessageSize);
    });

    it("HL-4 keeps a modest client limit exactly, neither rounded nor padded", () => {
        const limits = adjustLimitsWithParameters(hello(200 * 1024), params);
        limits.maxMessageSize.should.eql(200 * 1024);
    });
});
