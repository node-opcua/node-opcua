// launch with mocha -r ts-node/register test/*.ts
// or compile with  tsc  -t es2017 -m commonjs test\test_security.ts  --outdir toto
import fs from "fs";
import path from "path";
import { } from "mocha";

import "should";
import chalk from "chalk";
import { ErrorCallback } from "node-opcua-status-code";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import {
    Certificate,
    readCertificate,
    split_der,
    readCertificateRevocationList,
    PrivateKey,
    readPrivateKey
} from "node-opcua-crypto";
import { EndpointDescription } from "node-opcua-service-endpoints";
import { TransportPairDirect } from "node-opcua-transport/dist/test_helpers";
import { FindServersRequest, FindServersResponse } from "node-opcua-types";
import { hexDump } from "node-opcua-debug";

import {
    ClientSecureChannelLayer,
    ClientSecureChannelParent,
    getThumbprint,
    invalidPrivateKey,
    Message,
    MessageSecurityMode,
    SecurityPolicy,
    ServerSecureChannelLayer,
    ServerSecureChannelParent
} from "..";

const doDebug = false;

type SimpleCallback = (err?: Error | null) => void;

interface TestParam {
    securityMode: MessageSecurityMode;
    securityPolicy: SecurityPolicy;
    serverCertificate?: Certificate;
    clientCertificate?: Certificate;
    serverPrivateKey: PrivateKey;
    clientPrivateKey: PrivateKey;
    shouldFailAtClientConnection?: boolean;
}

const certificateFolder = path.join(__dirname, "../../../packages/node-opcua-samples/certificates");
fs.existsSync(certificateFolder).should.eql(true, "expecting certificate store at " + certificateFolder);

const NODE_NO_SUPPORT_SECURITY_BASIC128RSA15 = parseInt((process.version.match(/^v([0-9]+)/)![1]) || "0", 10) >= 21;
console.log("NODE_NO_SUPPORT_SECURITY_BASIC128RSA15 = ", NODE_NO_SUPPORT_SECURITY_BASIC128RSA15);

// tslint:disable:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing secure client and server connection", function (this: any) {
    this.timeout(120 * 1000);
    const certificateManager = new OPCUACertificateManager({
        automaticallyAcceptUnknownCertificate: true,
        rootFolder: path.join(__dirname, "../certificates")
    });

    before(async () => {
        certificateManager.referenceCounter++;
        await certificateManager.initialize();

        doDebug && console.log("certificateManager initialized", certificateManager.rootDir);

        const issuerCertificateFile = path.join(certificateFolder, "CA/public/cacert.pem");
        const issuerCertificate = readCertificate(issuerCertificateFile);
        await certificateManager.addIssuer(issuerCertificate);

        const issuerCertificateRevocationListFile = path.join(certificateFolder, "CA/crl/revocation_list.der");
        const crl = await readCertificateRevocationList(issuerCertificateRevocationListFile);
        await certificateManager.addRevocationList(crl);
    });

    after(() => {
        certificateManager.referenceCounter--;
        certificateManager.dispose();
    });

    let transportPair: TransportPairDirect;
    beforeEach((done) => {
        transportPair = new TransportPairDirect();
        transportPair.initialize(done);
    });
    afterEach((done) => {
        transportPair.shutdown(done);
    });

    async function performTest(param: TestParam) {
        doDebug && console.log("performTest ", {
            shouldFailAtClientConnection: param.shouldFailAtClientConnection,
            clientCertificate: getThumbprint(param.clientCertificate!)?.toString("hex"),
            securityMode: MessageSecurityMode[param.securityMode],
            SecurityPolicy: param.securityPolicy,
            serverCertificate: getThumbprint(param.serverCertificate!)?.toString("hex")
        });

        const parentS: ServerSecureChannelParent = {
            certificateManager,

            // tslint:disable-next-line:object-literal-shorthand
            getCertificate: function () {
                const firstCertificateInChain = split_der(this.getCertificateChain())[0];
                return firstCertificateInChain!;
            },

            getCertificateChain: () => {
                return param.serverCertificate!;
            },

            getEndpointDescription: (
                securityMode: MessageSecurityMode,
                securityPolicy: SecurityPolicy,
                endpointUri: string | null
            ) => {
                return new EndpointDescription({});
            },

            getPrivateKey: (): PrivateKey => {
                return param.serverPrivateKey;
            }
        };

        const serverSChannel: ServerSecureChannelLayer = new ServerSecureChannelLayer({
            defaultSecureTokenLifetime: 0,
            objectFactory: undefined,
            parent: parentS,
            timeout: 0
        });
        const s = serverSChannel.send_response;
        serverSChannel.send_response = function (
            this: ServerSecureChannelLayer,
            msgType: string,
            response: any,
            message: Message,
            callback?: ErrorCallback
        ): void {
            s.call(this, msgType, response, message, callback);
        };

        async function simulateOpenSecureChannel() {
            return new Promise<void>((resolve, reject) => {
                clientChannel.create("fake://foobar:123", (err?: Error) => {
                    if (param.shouldFailAtClientConnection) {
                        if (!err) {
                            return reject(new Error(" Should have failed here !"));
                        }
                        resolve();
                    } else {
                        err ? reject(err) : setImmediate(() => resolve());
                    }
                });
            });
        }

        async function simulateTransaction(request: FindServersRequest, response: FindServersResponse) {
            serverSChannel.once("message", (message: Message) => {
                doDebug && console.log("server receiving message =", response.responseHeader.requestHandle);
                response.responseHeader.requestHandle = message.request.requestHeader.requestHandle;
                serverSChannel.send_response("MSG", response, message, () => {
                    /** */
                    doDebug && console.log("server message sent ", response.responseHeader.requestHandle);
                });
            });

            doDebug && console.log(" now sending a request " + request.constructor.name);

            await new Promise<void>((resolve, reject) => {
                clientChannel.performMessageTransaction(request, (err, response) => {
                    doDebug && console.log("client received a response ", response?.constructor.name);
                    doDebug && console.log(response?.toString());
                    err ? reject(err) : resolve();
                });
            });
        }

        const serverSocket = transportPair.server;

        const parentC: ClientSecureChannelParent = {
            // tslint:disable-next-line:object-literal-shorthand
            getCertificate: function () {
                const firstCertificateInChain = split_der(this.getCertificateChain())[0];
                return firstCertificateInChain!;
            },

            getCertificateChain: () => {
                return param.clientCertificate!;
            },

            getPrivateKey: (): PrivateKey => {
                return param.clientPrivateKey;
            }
        };

        const clientChannel = new ClientSecureChannelLayer({
            connectionStrategy: {
                maxDelay: 100,
                maxRetry: 0
            },
            defaultSecureTokenLifetime: 1000000,
            tokenRenewalInterval: 200, // very short ! but not zero
            defaultTransactionTimeout: 1000000,
            parent: parentC,
            securityMode: param.securityMode,
            securityPolicy: param.securityPolicy,
            serverCertificate: param.serverCertificate,
            transportTimeout: 0,
            transportSettings: {
                maxChunkCount: 1000,
                maxMessageSize: 0,
                receiveBufferSize: 0,
                sendBufferSize: 0
            }
        });
        clientChannel.on("receive_chunk", (chunk: Buffer) => {
            doDebug && console.log(chalk.green(hexDump(chunk, 32, 20000)));
        });
        clientChannel.on("send_chunk", (chunk: Buffer) => {
            doDebug && console.log(chalk.cyan(hexDump(chunk, 32, 20000)));
        });

        //xx serverSChannel will discover security settings automatically serverSChannel.setSecurity(param.securityMode, param.securityPolicy);
        if (param.serverCertificate) {
            // client do not have certificate manager  at this time
            // const certMan = clientChannel.certificateManager;
            // await certMan.trustCertificate(param.serverCertificate);
        }


        if (param.clientCertificate) {
            await serverSChannel.certificateManager.trustCertificate(param.clientCertificate);

            const statusCode = await serverSChannel.certificateManager.checkCertificate(param.clientCertificate);
            const chain = split_der(param.clientCertificate!);
            doDebug &&console.log("certificate thumbprint ", chain.length, getThumbprint(param.clientCertificate!)?.toString("hex"));
            doDebug &&console.log("statusCode = ", statusCode.toString());

            const statusCode2 = await serverSChannel.certificateManager.checkCertificate(chain[0]);
            doDebug &&console.log("statusCode = ", getThumbprint(chain[0])?.toString("hex"), statusCode2.toString());

            for (const cert of chain) {
                await serverSChannel.certificateManager.trustCertificate(cert);
                const statusCode4 = await serverSChannel.certificateManager.checkCertificate(cert);
                doDebug &&console.log("statusCode = ", getThumbprint(cert)?.toString("hex"), statusCode4.toString());
            }
        }

        doDebug &&console.log("server secure channel init")
        await new Promise<void>((resolve, reject) => {
            serverSChannel.init(serverSocket, (err?: Error) => {
                doDebug && console.log("server secure channel initialized");
                //                err ? reject(err) : resolve();
            });
            resolve();
        });
        doDebug && console.log("server secure channel initialized");


        doDebug && console.log("simulateOpenSecureChannel");

        await simulateOpenSecureChannel();
        doDebug && console.log("simulateOpenSecureChannel: done ");


        let errorCounter = 0;
        if (!param.shouldFailAtClientConnection) {
            doDebug && console.log("sending a request");

            try {
                const request = new FindServersRequest({});
                const response = new FindServersResponse({});
                await simulateTransaction(request, response);
            } catch (err) {
                doDebug && console.log("err", err);
                errorCounter++;
            }
        }

        if (param.securityMode !== MessageSecurityMode.None) {
            doDebug && console.log("Wait for token renewal");
            await new Promise<void>((resolve, reject) => {
                clientChannel.once("security_token_renewed", () => {
                    doDebug && console.log("security_token_renewed");
                    resolve();
                });
            });
        }


        if (!param.shouldFailAtClientConnection) {
            doDebug && console.log("sending a request");

            try {
                const request = new FindServersRequest({});
                const response = new FindServersResponse({});
                await simulateTransaction(request, response);
            } catch (err) {
                doDebug && console.log("err", err);
                console.log((err as Error).message);
                errorCounter++;
            }
        }

        if (!param.shouldFailAtClientConnection) {
            await new Promise<void>((resolve) => clientChannel.close(() => resolve()));
        }
        await new Promise<void>((resolve) => serverSChannel.close(() => resolve()));
        serverSChannel.dispose();

        errorCounter.should.eql(0);
    }

    async function performTest1(
        sizeC: number,
        sizeS: number,
        securityMode: MessageSecurityMode,
        securityPolicy: SecurityPolicy
    ): Promise<void> {
        function m(file: string): string {
            const fullPathname = path.join(certificateFolder, file);
            if (!fs.existsSync(fullPathname)) {
                throw new Error("file must exist: " + fullPathname);
            }
            return fullPathname;
        }

        const serverCertificateFile = m(`server_cert_${sizeS}.pem`);
        const serverPrivateKeyFile = m(`server_key_${sizeS}.pem`);
        const serverCertificate = readCertificate(serverCertificateFile);
        const serverPrivateKey = readPrivateKey(serverPrivateKeyFile);

        const clientCertificateFile = m(`client_cert_${sizeC}.pem`);
        const clientPrivateKeyFile = m(`client_key_${sizeC}.pem`);
        const clientCertificate = readCertificate(clientCertificateFile);
        const clientPrivateKey = readPrivateKey(clientPrivateKeyFile);

        await performTest({
            clientCertificate,
            clientPrivateKey,
            securityMode,
            securityPolicy,
            serverCertificate,
            serverPrivateKey
            //   shouldFailAtClientConnection: false,
        });
    }
    it("RR-001 client & server channel  - no security ", async () => {
        await performTest({
            securityMode: MessageSecurityMode.None,
            securityPolicy: SecurityPolicy.None,
            serverCertificate: undefined,
            serverPrivateKey: invalidPrivateKey,
            clientPrivateKey: invalidPrivateKey
        });
    });
    it("RR-002 client & server channel  - with security ", async () => {
        await performTest1(2048, 2048, MessageSecurityMode.Sign, SecurityPolicy.Basic256);
    });

    it("RR-003 client & server channel  - A", async () => {
        await performTest1(2048, 2048, MessageSecurityMode.Sign, SecurityPolicy.Basic256);
    });

    let index = 4;
    for (const sizeC of [1024, 2048, 3072, 4096]) {
        for (const sizeS of [1024, 2048, 3072, 4096]) {
            for (const mode of [MessageSecurityMode.Sign, MessageSecurityMode.SignAndEncrypt]) {
                for (const policy of [
                    NODE_NO_SUPPORT_SECURITY_BASIC128RSA15 ? SecurityPolicy.Basic256Sha256 : SecurityPolicy.Basic128Rsa15,
                    // xx SecurityPolicy.Basic128,
                    // Xx SecurityPolicy.Basic192,
                    // Xs SecurityPolicy.Basic192Rsa15,
                    SecurityPolicy.Basic256Sha256,
                    SecurityPolicy.Aes128_Sha256_RsaOaep,
                    SecurityPolicy.Aes256_Sha256_RsaPss,
                    SecurityPolicy.Basic256
                ]) {
                    it(
                        `RR-${(index++).toString().padStart(3, "0")}` +
                        " client & server channel  - " +
                        sizeC +
                        " " +
                        sizeS +
                        " " +
                        policy,
                        async () => {
                            await performTest1(sizeC, sizeS, mode, policy);
                        }
                    );
                }
            }
        }
    }
});
