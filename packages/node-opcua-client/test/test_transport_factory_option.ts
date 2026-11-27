import net from "node:net";
import { InMemoryCertificateKeyPairProvider } from "node-opcua-common";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { defaultClientTransportFactory, type TransportSettingsOptions } from "node-opcua-transport";
import should from "should";
import sinon from "sinon";

import { MessageSecurityMode, OPCUAClient, SecurityPolicy } from "../dist/index.js";

/**
 * A closed local port: bind an ephemeral port, then close it, so connect() is refused at once.
 */
async function getUnreachableEndpoint(): Promise<string> {
    const server = net.createServer();
    // check-test-ports: dynamic-ok - wants a port guaranteed closed, so connect is refused rather than hanging
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as net.AddressInfo).port;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    return `opc.tcp://127.0.0.1:${port}`;
}

describe("OPCUAClient + transportFactory option", () => {
    it("accepts a transportFactory option on OPCUAClientOptions", () => {
        const factory = { create: sinon.stub() };
        // Construction alone is the assertion — previously the option was
        // not a member of OPCUAClientBaseOptions and would be a compile error.
        const client = OPCUAClient.create({ transportFactory: factory });
        should.exist(client);
    });

    it("does not require a transportFactory (default is Node TCP transport)", () => {
        const client = OPCUAClient.create({});
        should.exist(client);
    });

    it("uses the transportFactory for the connection that fetches the server certificate", async () => {
        // Each transport the factory creates is the default one, with the URL it dials recorded.
        const dialed: string[] = [];
        const create = (settings?: TransportSettingsOptions) => {
            const transport = defaultClientTransportFactory.create(settings);
            const connect = transport.connect.bind(transport);
            transport.connect = (endpointUrl, callback) => {
                dialed.push(endpointUrl);
                connect(endpointUrl, callback);
            };
            return transport;
        };

        // The in-memory provider keeps the client off the disk: no PKI folder, no certificate file.
        // connect() needs the certificate of the client before it dials anything.
        const applicationUri = "urn:test:transport-factory";
        const certificateKeyPairProvider = new InMemoryCertificateKeyPairProvider();
        await certificateKeyPairProvider.ensureCertificateExists({
            applicationUri,
            subject: "/CN=transport-factory-test",
            dns: []
        });

        // A secured connection without a serverCertificate: connect() first fetches the
        // certificate from the endpoints of the server, with a connection of its own.
        const client = OPCUAClient.create({
            applicationUri,
            certificateKeyPairProvider,
            connectionStrategy: { maxRetry: 0 },
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256,
            transportFactory: { create }
        });
        try {
            const endpointUrl = await getUnreachableEndpoint();
            let caught: unknown;
            try {
                await client.connect(endpointUrl);
            } catch (err) {
                caught = err;
            }

            // Nothing listens, so fetching the certificate fails, and connect() stops there.
            should.exist(caught, "expecting connect() to fail (unreachable endpoint)");
            (caught as Error).message.should.match(/to collect server's certificate \(in findEndpoint\)/);

            // That one connection came from the factory, and it dialed the endpoint.
            dialed.should.eql([endpointUrl], "the certificate fetch must dial through the transportFactory");
        } finally {
            await client.disconnect().catch(() => {
                /* already disconnected/failed */
            });
        }
    });
});
