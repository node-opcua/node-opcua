import should from "should";

import { OPCUAClient } from "node-opcua-client";
import { InMemoryCertificateStore } from "node-opcua-common";
import type { IClientTransportFactory } from "node-opcua-transport";

import { browserWsTransportFactory, createBrowserClient } from "../../dist";

describe("createBrowserClient", () => {
    it("returns a constructed OPCUAClient (no throw)", () => {
        // `OPCUAClient` is a facade class whose `create()` returns an
        // `OPCUAClientImpl` cast through `as unknown`; `instanceof OPCUAClient`
        // would always be false. Assert via duck-typing instead — every
        // OPCUAClientImpl exposes `connect` / `disconnect` / `createSession`.
        const client = createBrowserClient();
        should.exist(client);
        client.connect.should.be.a.Function();
        client.disconnect.should.be.a.Function();
        client.createSession.should.be.a.Function();
        // Reference OPCUAClient so this import isn't pruned in compiled JS.
        OPCUAClient.create.should.be.a.Function();
    });

    it("defaults `transportFactory` to `browserWsTransportFactory` when not supplied", () => {
        const client = createBrowserClient();
        // OPCUAClientImpl stores transportFactory as a private field; the cast
        // exposes it for white-box assertion. There is no public getter today.
        const tf = (client as unknown as { _transportFactory?: IClientTransportFactory })
            ._transportFactory;
        should.exist(tf);
        tf!.should.equal(browserWsTransportFactory);
    });

    it("preserves a caller-supplied `transportFactory`", () => {
        const customFactory: IClientTransportFactory = {
            // biome-ignore lint/suspicious/noExplicitAny: stub
            create: (() => null) as any
        };
        const client = createBrowserClient({ transportFactory: customFactory });
        const tf = (client as unknown as { _transportFactory?: IClientTransportFactory })
            ._transportFactory;
        tf!.should.equal(customFactory);
    });

    it("defaults `clientCertificateManager` to an `InMemoryCertificateStore`", () => {
        const client = createBrowserClient();
        client.clientCertificateManager.should.be.instanceof(InMemoryCertificateStore);
    });

    it("preserves a caller-supplied `clientCertificateManager`", () => {
        const store = new InMemoryCertificateStore({ autoAcceptUnknown: false });
        const client = createBrowserClient({ clientCertificateManager: store });
        client.clientCertificateManager.should.equal(store);
    });

    it("defaults to an in-memory cert/key provider when none supplied", () => {
        const client = createBrowserClient();
        // Both file paths come from `InMemoryCertificateKeyPairProvider`'s
        // `<in-memory>` getters; a disk-backed provider would resolve real
        // paths under the cert manager's rootDir.
        client.certificateFile.should.equal("<in-memory>");
        client.privateKeyFile.should.equal("<in-memory>");
    });

    it("populates the in-memory cert/key provider with `clientCertificate` + `clientPrivateKey`", () => {
        // Use a real DER-shaped buffer (Sequence tag + length); the
        // in-memory provider holds it opaquely so any non-empty buffer
        // suffices for round-trip verification.
        const cert = Buffer.from([0x30, 0x82, 0x01, 0x00]) as never;
        // biome-ignore lint/suspicious/noExplicitAny: opaque PrivateKey shape
        const key = { hidden: "test-key" } as any;
        const client = createBrowserClient({
            clientCertificate: cert,
            clientPrivateKey: key
        });
        // `getCertificateChain` / `getPrivateKey` are inherited from
        // OPCUASecureObject and delegate to the in-memory provider that
        // createBrowserClient installed.
        client.getCertificateChain().should.deepEqual([cert]);
        client.getPrivateKey().should.equal(key);
    });

    it("treats `clientCertificate` as a single-cert chain when not an array", () => {
        const cert = Buffer.from([0x30, 0x01]) as never;
        // biome-ignore lint/suspicious/noExplicitAny: opaque
        const key = { hidden: "k" } as any;
        const client = createBrowserClient({
            clientCertificate: cert,
            clientPrivateKey: key
        });
        const chain = client.getCertificateChain();
        chain.should.have.length(1);
        chain[0].should.equal(cert);
    });

    it("preserves a caller-supplied `certificateKeyPairProvider`", () => {
        // When the caller supplies their own provider, createBrowserClient
        // must NOT replace it with one populated from `clientCertificate`/
        // `clientPrivateKey`. Verify by inspecting which getter wins.
        const ownCert = Buffer.from([0xaa]) as never;
        // biome-ignore lint/suspicious/noExplicitAny: opaque
        const ownKey = { hidden: "own" } as any;
        const ignoredCert = Buffer.from([0xbb]) as never;
        // biome-ignore lint/suspicious/noExplicitAny: opaque
        const ignoredKey = { hidden: "ignored" } as any;

        const myProvider = {
            certificateFile: "<test>",
            privateKeyFile: "<test>",
            getCertificate: () => ownCert,
            getCertificateChain: () => [ownCert],
            getPrivateKey: () => ownKey
        };
        const client = createBrowserClient({
            certificateKeyPairProvider: myProvider,
            clientCertificate: ignoredCert,
            clientPrivateKey: ignoredKey
        });
        client.getCertificateChain().should.deepEqual([ownCert]);
        client.getPrivateKey().should.equal(ownKey);
    });
});
