/**
 * A TrustList re-check (closeChannelsNoLongerTrusted) that runs while the
 * server is refusing an OpenSecureChannelRequest leaves that channel alone:
 * the server answers the refusal, then closes the channel itself.
 *
 * The server waits ServerSecureChannelLayer.throttleTime before it sends the
 * refusal. A re-check that closed the channel in that window cut the answer:
 * the client saw "socket has been disconnected by third party" instead of
 * BadSecurityChecksFailed. The test widens the window so the re-check runs in
 * it every time.
 *
 * To see it fail: remove the isClosing(channel) check of
 * _closeChannelsNoLongerTrusted.
 */
import fs from "node:fs";
import path from "node:path";

import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { OPCUAClient } from "node-opcua-client";
import { makeSHA1Thumbprint, readCertificateChain } from "node-opcua-crypto";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { MessageSecurityMode, SecurityPolicy, ServerSecureChannelLayer } from "node-opcua-secure-channel";
import { OPCUAServer, type OPCUAServerEndPoint } from "node-opcua-server";
import should from "should";

import { closeChannelsNoLongerTrusted, installPushCertificateManagementOnServer } from "../../dist/index.js";
import { initializeHelpers } from "../helpers/fake_certificate_authority.js";

const port = 20221;

interface WithThrottleTime {
    throttleTime: number;
}

async function waitUntil(check: () => boolean, timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    while (!check()) {
        if (Date.now() - start > timeoutMs) {
            return false;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return true;
}

async function certificateManager(folder: string, name: string, automaticallyAcceptUnknownCertificate: boolean) {
    const rootFolder = path.join(folder, `${name}_${Math.random().toString(36).slice(2, 10)}`);
    fs.mkdirSync(rootFolder, { recursive: true });
    const cm = new OPCUACertificateManager({ rootFolder, automaticallyAcceptUnknownCertificate });
    await cm.initialize();
    return cm;
}

function clientWith(clientCertificateManager: OPCUACertificateManager) {
    return OPCUAClient.create({
        clientCertificateManager,
        securityMode: MessageSecurityMode.SignAndEncrypt,
        securityPolicy: SecurityPolicy.Basic256Sha256,
        endpointMustExist: false,
        connectionStrategy: { maxRetry: 0 }
    });
}

describe("TrustList re-check while a SecureChannel is being refused", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 30_000));

    const layer = ServerSecureChannelLayer as unknown as WithThrottleTime;
    const originalThrottleTime = layer.throttleTime;
    let folder: string;

    before(async () => {
        folder = await initializeHelpers("TrustListRecheckRefusing", 1);
        layer.throttleTime = 1500;
    });
    after(() => {
        layer.throttleTime = originalThrottleTime;
    });

    it("TLR-1 the refused client receives BadSecurityChecksFailed, and the re-check closes nothing", async () => {
        const serverPki = await certificateManager(folder, "ServerPKI", false);
        const server = new OPCUAServer({ port, serverCertificateManager: serverPki, userCertificateManager: serverPki });
        await server.initialize();
        await installPushCertificateManagementOnServer(server);
        await server.start();

        const clientPki = await certificateManager(folder, "ClientPKI", true);
        const client = clientWith(clientPki);
        try {
            // the server does not trust the client: it decides to refuse, then waits throttleTime
            const connecting = client.connect(server.getEndpointUrl()).then(
                () => undefined,
                (err: Error) => err
            );
            const endpoint = server.endpoints[0] as OPCUAServerEndPoint;
            const refusing = await waitUntil(() => endpoint.getChannels().some((c) => c.status === "closing"), 10_000);
            should(refusing).eql(true, "the server never started refusing the channel");

            should(await closeChannelsNoLongerTrusted(server)).eql(0);

            const err = await connecting;
            should(err).be.instanceOf(Error);
            should((err as Error).message).match(/BadSecurityChecksFailed/);
        } finally {
            await client.disconnect();
            await server.shutdown();
            await clientPki.dispose();
            await serverPki.dispose();
        }
    });

    it("TLR-2 an open channel whose certificate leaves the TrustList is still closed", async () => {
        const serverPki = await certificateManager(folder, "ServerPKI", false);
        const server = new OPCUAServer({ port, serverCertificateManager: serverPki, userCertificateManager: serverPki });
        await server.initialize();
        await installPushCertificateManagementOnServer(server);
        await server.start();

        const clientPki = await certificateManager(folder, "ClientPKI", true);
        const refused = clientWith(clientPki);
        const client = clientWith(clientPki);
        try {
            // a first, refused attempt files the client certificate under rejected/: trust it from there
            await refused.connect(server.getEndpointUrl()).catch(() => undefined);
            await refused.disconnect();
            const [file] = fs.readdirSync(serverPki.rejectedFolder);
            const certificate = readCertificateChain(path.join(serverPki.rejectedFolder, file))[0];
            await serverPki.trustCertificate(certificate);

            await client.connect(server.getEndpointUrl());
            const endpoint = server.endpoints[0] as OPCUAServerEndPoint;
            const isOpen = () => endpoint.getChannels().some((c) => c.status === "open");
            should(isOpen()).eql(true);

            await serverPki.removeTrustedCertificate(makeSHA1Thumbprint(certificate).toString("hex"));
            await closeChannelsNoLongerTrusted(server);
            // closed by this call, or by the re-check the TrustList change started on its own
            should(await waitUntil(() => !isOpen(), 10_000)).eql(true, "the channel is still open");
        } finally {
            await client.disconnect();
            await server.shutdown();
            await clientPki.dispose();
            await serverPki.dispose();
        }
    });
});
