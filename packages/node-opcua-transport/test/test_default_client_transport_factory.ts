import should from "should";
import {
    ClientTCP_transport,
    defaultClientTransportFactory,
    type IClientTransport,
    type IClientTransportFactory
} from "../dist/source/index.js";

describe("defaultClientTransportFactory / IClientTransport", () => {
    it("returns a ClientTCP_transport instance", () => {
        const t = defaultClientTransportFactory.create({});
        t.should.be.instanceof(ClientTCP_transport);
        // sanity: a new factory call must not re-use the same instance
        const t2 = defaultClientTransportFactory.create({});
        (t !== t2).should.be.true();
        t.dispose();
        t2.dispose();
    });

    it("factory honours TransportSettingsOptions", () => {
        const t = defaultClientTransportFactory.create({
            maxChunkCount: 7,
            maxMessageSize: 987_654,
            receiveBufferSize: 8192,
            sendBufferSize: 8192
        }) as ClientTCP_transport;
        // the constructor copies settings into a private _helloSettings object; it is
        // surfaced via getTransportSettings() which is part of IClientTransport
        const s = t.getTransportSettings();
        should(s.maxChunkCount).equal(7);
        should(s.maxMessageSize).equal(987_654);
        should(s.receiveBufferSize).equal(8192);
        should(s.sendBufferSize).equal(8192);
        t.dispose();
    });

    it("ClientTCP_transport is assignable to IClientTransport (compile-time check)", () => {
        // If this file compiles, ClientTCP_transport satisfies IClientTransport.
        const t = new ClientTCP_transport({});
        const asIface: IClientTransport = t; // no cast
        asIface.name.should.be.a.String();
        asIface.dispose();
    });

    it("defaultClientTransportFactory conforms to IClientTransportFactory", () => {
        const f: IClientTransportFactory = defaultClientTransportFactory;
        f.create.should.be.a.Function();
    });
});
