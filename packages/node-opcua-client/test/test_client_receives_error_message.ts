// OPC 10000-6 §7.1.5: "When the Client receives an Error Message it reports the error to the
// application and closes the TransportConnection gracefully."
//
// A server that does not trust the client certificate answers the OpenSecureChannel request with
// an Error Message (ERR, Bad_SecurityChecksFailed, §6.7.7) and closes the socket. connect() used to
// reject with "socket has been disconnected by third party": the StatusCode never reached the caller.
import fs from "node:fs";
import { createServer, type Server, type Socket } from "node:net";
import os from "node:os";
import path from "node:path";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { MessageSecurityMode, SecurityPolicy } from "node-opcua-secure-channel";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { AcknowledgeMessage, packTcpMessage } from "node-opcua-transport";
import should from "should";

import { OPCUAClient } from "../dist/index.js";

const port = 20131;

// the 16 bytes such a server sends: "ERRF", length 16, Error = BadSecurityChecksFailed, Reason = null string
function errBadSecurityChecksFailedWithNullReason(): Buffer {
    const chunk = Buffer.alloc(16);
    chunk.write("ERRF", 0, "ascii");
    chunk.writeUInt32LE(16, 4);
    chunk.writeUInt32LE(StatusCodes.BadSecurityChecksFailed.value, 8);
    chunk.writeInt32LE(-1, 12);
    return chunk;
}

/** a server that acknowledges HEL, then answers OPN with ERR and closes the connection */
function startServerRejectingOpenSecureChannel(): Promise<{ server: Server; sockets: Set<Socket> }> {
    const sockets = new Set<Socket>();
    const server = createServer((socket) => {
        sockets.add(socket);
        socket.on("close", () => sockets.delete(socket));
        socket.on("error", () => {
            /* the client may reset the connection */
        });
        let pending = Buffer.alloc(0);
        socket.on("data", (data: Buffer) => {
            pending = Buffer.concat([pending, data]);
            while (pending.length >= 8 && pending.length >= pending.readUInt32LE(4)) {
                const msgType = pending.subarray(0, 3).toString("ascii");
                pending = pending.subarray(pending.readUInt32LE(4));
                if (msgType === "HEL") {
                    socket.write(
                        packTcpMessage(
                            "ACK",
                            new AcknowledgeMessage({
                                protocolVersion: 0,
                                receiveBufferSize: 8192,
                                sendBufferSize: 8192,
                                maxMessageSize: 100000,
                                maxChunkCount: 600000
                            })
                        )
                    );
                } else if (msgType === "OPN") {
                    socket.end(errBadSecurityChecksFailedWithNullReason());
                }
            }
        });
    });
    return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, () => resolve({ server, sockets }));
    });
}

describe("OPCUAClient#connect when the server answers OpenSecureChannel with an Error Message", function (this: Mocha.Context) {
    this.timeout(Math.max(30 * 1000, this.timeout()));

    it("CRE-1 connect() rejects with the StatusCode and reason of the ERR", async () => {
        const { server, sockets } = await startServerRejectingOpenSecureChannel();
        const tmpDir = path.join(os.tmpdir(), `test-client-receives-error-message-${process.pid}-${Date.now()}`);
        const clientCertificateManager = new OPCUACertificateManager({
            rootFolder: path.join(tmpDir, "pki"),
            disableFileWatchers: true
        });
        const client = OPCUAClient.create({
            clientCertificateManager,
            endpointMustExist: false,
            securityMode: MessageSecurityMode.None,
            securityPolicy: SecurityPolicy.None,
            connectionStrategy: { maxRetry: 0, initialDelay: 10, maxDelay: 20 }
        });
        try {
            let err: (Error & { statusCode?: StatusCode; reason?: string | null }) | undefined;
            try {
                await client.connect(`opc.tcp://127.0.0.1:${port}`);
            } catch (e) {
                err = e as Error;
            }
            should(err).be.instanceOf(Error);
            const rejection = err as Error & { statusCode?: StatusCode; reason?: string | null };
            // the wording callers match on is kept as a prefix
            should(rejection.message).match(/^The connection may have been rejected by server/);
            should(rejection.message).match(/BadSecurityChecksFailed \(0x80130000\)/);
            should(rejection.message).not.match(/third party/);
            should(rejection.statusCode).eql(StatusCodes.BadSecurityChecksFailed);
            should(rejection.reason).eql(null);
        } finally {
            await client.disconnect();
            for (const socket of sockets) {
                socket.destroy();
            }
            await new Promise<void>((resolve) => server.close(() => resolve()));
            await clientCertificateManager.dispose();
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });
});
