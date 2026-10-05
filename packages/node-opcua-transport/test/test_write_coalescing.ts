import { EventEmitter } from "node:events";
import should from "should";

import { AcknowledgeMessage, type ISocketLike, packTcpMessage, ServerTCP_transport } from "../dist/source/index.js";

/** a socket that records, in order, what the transport asks of it */
class RecordingSocket extends EventEmitter {
    public calls: string[] = [];
    public destroyed = false;
    public write(_data: string | Buffer, callback?: (err?: Error | null) => undefined): void {
        this.calls.push("write");
        callback?.();
    }
    public cork(): void {
        this.calls.push("cork");
    }
    public uncork(): void {
        this.calls.push("uncork");
    }
    public end(): void {
        this.calls.push("end");
    }
    public destroy(): void {
        this.calls.push("destroy");
        this.destroyed = true;
    }
    public setKeepAlive(): this {
        return this;
    }
    public setNoDelay(): this {
        return this;
    }
    public setTimeout(): this {
        return this;
    }
}

function nextTick(): Promise<void> {
    return new Promise((resolve) => process.nextTick(resolve));
}

describe("TCP_transport: chunks written in the same tick leave the socket together", () => {
    const chunk = packTcpMessage(
        "ACK",
        new AcknowledgeMessage({
            maxChunkCount: 0,
            maxMessageSize: 0,
            protocolVersion: 0,
            receiveBufferSize: 8192,
            sendBufferSize: 8192
        })
    );

    let transport: ServerTCP_transport;
    function install(socket: EventEmitter): void {
        transport = new ServerTCP_transport();
        transport.timeout = 1000;
        transport.init(socket as unknown as ISocketLike, () => {
            /* no HEL is ever sent in these tests */
        });
    }
    afterEach(() => {
        transport.dispose();
    });

    it("corks once, and uncorks at the end of the tick", async () => {
        const socket = new RecordingSocket();
        install(socket);

        transport.write(chunk);
        transport.write(chunk);
        transport.write(chunk);
        should(socket.calls).eql(["cork", "write", "write", "write"]);

        await nextTick();
        should(socket.calls).eql(["cork", "write", "write", "write", "uncork"]);
    });

    // what a server does: the responses to the requests of one "data" event are each written
    // from a promise continuation, and the socket is released once they have all run
    it("holds the chunks written by successive promise continuations", async () => {
        const socket = new RecordingSocket();
        install(socket);

        await Promise.resolve();
        transport.write(chunk);
        await Promise.resolve();
        transport.write(chunk);
        await Promise.resolve();
        should(socket.calls).eql(["cork", "write", "write"]);

        await nextTick();
        should(socket.calls).eql(["cork", "write", "write", "uncork"]);
    });

    it("starts over on the next tick", async () => {
        const socket = new RecordingSocket();
        install(socket);

        transport.write(chunk);
        await nextTick();
        transport.write(chunk);
        await nextTick();
        should(socket.calls).eql(["cork", "write", "uncork", "cork", "write", "uncork"]);
    });

    it("sends what it holds before the socket is destroyed", () => {
        const socket = new RecordingSocket();
        install(socket);

        transport.write(chunk);
        transport.dispose();
        should(socket.calls).eql(["cork", "write", "uncork", "destroy"]);
    });

    it("sends what it holds before a premature termination", () => {
        const socket = new RecordingSocket();
        install(socket);

        transport.write(chunk);
        transport.prematureTerminate(new Error("test"), { toString: () => "BadTcpInternalError" } as never);
        should(socket.calls.slice(0, 4)).eql(["cork", "write", "uncork", "destroy"]);
    });

    it("writes straight through a socket that cannot be corked", async () => {
        const socket = new RecordingSocket();
        (socket as unknown as { cork?: unknown }).cork = undefined;
        install(socket);

        transport.write(chunk);
        transport.write(chunk);
        await nextTick();
        should(socket.calls).eql(["write", "write"]);
    });
});
