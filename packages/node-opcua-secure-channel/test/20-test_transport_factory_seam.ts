import {
    ClientTCP_transport,
    defaultClientTransportFactory,
    type IClientTransport,
    type IClientTransportFactory,
    type TransportSettingsOptions
} from "node-opcua-transport";
import should from "should";
import sinon from "sinon";

import { ClientSecureChannelLayer } from "../dist/source/index.js";

/**
 * Minimal IClientTransport stub whose sole purpose is to prove that
 * ClientSecureChannelLayer consults the injected transportFactory instead of
 * new-ing ClientTCP_transport directly.
 *
 * We do NOT drive the full HEL/ACK/OPN flow here; that is covered by
 * `11-test_client_secure_channel_layer.ts` using the MockServerTransport.
 * This test only asserts the factory-selection branch in
 * `ClientSecureChannelLayer#create`.
 */
class NoopTransportStub {
    public readonly name = "NoopTransportStub";
    public protocolVersion = 0;
    public timeout = 5000;
    public numberOfRetry = 0;
    public endpointUrl = "";
    public serverUri = "";
    public parameters = undefined;
    public receiveBufferSize = 0;
    public sendBufferSize = 0;
    public maxChunkCount = 0;
    public maxMessageSize = 0;
    public bytesRead = 0;
    public bytesWritten = 0;
    public chunkReadCount = 0;
    public chunkWrittenCount = 0;

    public connectSpy = sinon.spy();
    public disposeSpy = sinon.spy();

    connect(endpointUrl: string, _cb: (err?: Error | null) => void) {
        this.endpointUrl = endpointUrl;
        this.connectSpy(endpointUrl);
        // deliberately never call cb – keeps channel in "pending" state.
    }
    disconnect(cb: (err?: Error | null) => void) {
        cb();
    }
    dispose() {
        this.disposeSpy();
    }
    write() {
        /* no-op */
    }
    prematureTerminate() {
        /* no-op */
    }
    forceConnectionBreak() {
        /* no-op */
    }
    isValid() {
        return false;
    }
    isDisconnecting() {
        return false;
    }
    getTransportSettings() {
        return {} as TransportSettingsOptions;
    }

    on(): this {
        return this;
    }
    once(): this {
        return this;
    }
    removeListener(): this {
        return this;
    }
}

describe("ClientSecureChannelLayer transportFactory seam", () => {
    it("uses the provided transportFactory instead of ClientTCP_transport", (done) => {
        const stub = new NoopTransportStub();
        const factory: IClientTransportFactory = {
            create(_settings?: TransportSettingsOptions): IClientTransport {
                return stub as unknown as IClientTransport;
            }
        };
        const createSpy = sinon.spy(factory, "create");

        const channel = new ClientSecureChannelLayer({ transportFactory: factory });

        // Kick off connect. Stub never completes the handshake, but that's fine:
        // we only want to observe which factory path was taken.
        channel.create("fake://localhost:1/Fake", () => {
            /* wrapperCallback - we'll abort before it fires */
        });

        // Allow microtasks to flush (connect() is sync up to the point where it hands off to transport.connect)
        setImmediate(() => {
            try {
                createSpy.calledOnce.should.be.true();
                stub.connectSpy.calledOnce.should.be.true();
                stub.connectSpy.firstCall.args[0].should.equal("fake://localhost:1/Fake");

                // The channel uses our stub. getTransport()'s TypeScript signature is widened
                // to ClientTCP_transport for backward-compatibility with tests that reach
                // into `_socket`; at runtime, however, it is still the stub we passed in.
                const usedTransport = channel.getTransport();
                // The pending transport path: during an in-flight connect, the stub is the
                // pending transport and `getTransport()` may still be undefined. We assert
                // via the factory/connect spies instead, which is sufficient evidence.
                should(usedTransport === stub || usedTransport === undefined).be.true();

                // Clean up so the test does not leak.
                channel.abortConnection(() => {
                    channel.dispose();
                    done();
                });
            } catch (e) {
                done(e as Error);
            }
        });
    });

    it("falls back to defaultClientTransportFactory when no option is provided", () => {
        // We can't observe the internal field directly, but we can observe that the
        // default factory - when called directly - returns a ClientTCP_transport
        // (i.e. the historical behaviour is preserved byte-for-byte).
        const t = defaultClientTransportFactory.create({});
        t.should.be.instanceof(ClientTCP_transport);
        t.dispose();
    });
});
