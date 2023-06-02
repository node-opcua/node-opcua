// launch with mocha -r ts-node/register test/*.ts
// or compile with  tsc  -t es2017 -m commonjs test\test_security.ts  --outdir toto
import * as fs from "fs";
import * as path from "path";

import "should";
import * as async from "async";
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
    invalidPrivateKey,
    Message,
    MessageSecurityMode,
    SecurityPolicy,
    ServerSecureChannelLayer,
    ServerSecureChannelParent
} from "../source";

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

// tslint:disable:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing secure client and server connection", () => {
    const certificateManager = new OPCUACertificateManager({});

    before(async () => {
        certificateManager.referenceCounter++;
        await certificateManager.initialize();
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

    function performTest(param: TestParam, done: (err?: Error) => void) {
        const parentS: ServerSecureChannelParent = {
            certificateManager,

            // tslint:disable-next-line:object-literal-shorthand
            getCertificate: function () {
                const chain = this.getCertificateChain();
                const firstCertificateInChain = split_der(chain)[0];
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
        (serverSChannel as any).send_response = function (
            this: ServerSecureChannelLayer,
            msgType: string,
            response: any,
            message: Message,
            callback?: ErrorCallback
        ): void {
            s.call(this, msgType, response, message, callback);
        };

        function simulateOpenSecureChannel(callback: SimpleCallback) {
            clientChannel.create("fake://foobar:123", (err?: Error) => {
                if (param.shouldFailAtClientConnection) {
                    if (!err) {
                        return callback(new Error(" Should have failed here !"));
                    }
                    callback();
                } else {
                    if (err) {
                        return callback(err);
                    }
                    setImmediate(() => callback());
                }
            });
        }
        function simulateTransaction(request: FindServersRequest, response: FindServersResponse, callback: SimpleCallback) {
            serverSChannel.once("message", (message: Message) => {
                doDebug && console.log("server receiving message =", response.responseHeader.requestHandle);
                response.responseHeader.requestHandle = message.request.requestHeader.requestHandle;
                serverSChannel.send_response("MSG", response, message, () => {
                    /** */
                    doDebug && console.log("server message sent ", response.responseHeader.requestHandle);
                });
            });

            doDebug && console.log(" now sending a request " + request.constructor.name);

            clientChannel.performMessageTransaction(request, (err, response) => {
                doDebug && console.log("client received a response ", response?.constructor.name);
                doDebug && console.log(response?.toString());
                callback(err || undefined);
            });
        }

        const serverSocket = transportPair.server ;

        const parentC: ClientSecureChannelParent = {
            // tslint:disable-next-line:object-literal-shorthand
            getCertificate: function () {
                const chain = this.getCertificateChain();
                const firstCertificateInChain = split_der(chain)[0];
                return firstCertificateInChain!;
            },

            getCertificateChain: () => {
                return param.clientCertificate!;
            },

            getPrivateKey: (): PrivateKey => {
                return param.clientPrivateKey;
            }
        };

        const clientChannel: ClientSecureChannelLayer = new ClientSecureChannelLayer({
            connectionStrategy: {
                maxDelay: 100,
                maxRetry: 0
            },
            defaultSecureTokenLifetime: 1000000,
            parent: parentC,
            securityMode: param.securityMode,
            securityPolicy: param.securityPolicy,
            serverCertificate: param.serverCertificate,
            tokenRenewalInterval: 150, // very short ! but not zero
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

        // function renewToken(callback: SimpleCallback) {
        //     const isInitial = false;
        //     (clientChannel as any)._open_secure_channel_request(isInitial, (err?: Error | null) => {
        //         /* istanbul ignore else */
        //         callback(err!);
        //     });
        // }

        async.series(
            [
                (callback: SimpleCallback) => {
                    serverSChannel.init(serverSocket, (err?: Error) => {
                        /* */
                        /// callback(err);
                        doDebug && console.log("server secure channel initialized");
                    });
                    //  clientChannel.connect("")
                    callback();
                },
                (callback: SimpleCallback) => {
                    (serverSChannel as any)._build_message_builder();

                    serverSChannel.setSecurity(param.securityMode, param.securityPolicy);
                    if (param.clientCertificate) {
                        const certMan = serverSChannel.certificateManager;
                        certMan.trustCertificate(param.clientCertificate, (err?: Error | null) => {
                            callback(err!);
                        });
                    } else {
                        callback();
                    }
                },

                (callback: SimpleCallback) => {
                    simulateOpenSecureChannel(callback);
                },

                (callback: SimpleCallback) => {
                    if (param.shouldFailAtClientConnection) {
                        return callback();
                    }
                    const request = new FindServersRequest({});
                    const response = new FindServersResponse({});
                    simulateTransaction(request, response, callback);
                },

                (callback: SimpleCallback) => {
                    if (param.shouldFailAtClientConnection) {
                        return callback();
                    }
                    clientChannel.once("security_token_renewed", () => {
                        doDebug && console.log("security_token_renewed");
                        callback();
                    });
                    /** */
                    // renew token

                    /// renewToken(callback)
                },
                (callback: SimpleCallback) => {
                    if (param.shouldFailAtClientConnection) {
                        return callback();
                    }
                    clientChannel.close(callback);
                },

                (callback: SimpleCallback) => {
                    serverSChannel.close();
                    serverSChannel.dispose();
                    callback();
                }
            ],
            (err) => done(err!)
        );
    }

    it("client & server channel  - no security ", (done) => {
        performTest(
            {
                securityMode: MessageSecurityMode.None,
                securityPolicy: SecurityPolicy.None,
                serverCertificate: undefined,
                serverPrivateKey: invalidPrivateKey,
                clientPrivateKey: invalidPrivateKey
            },
            done
        );
    });

    function performTest1(sizeC: number, sizeS: number, securityPolicy: SecurityPolicy, done: (err?: Error) => void): void {
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

        performTest(
            {
                clientCertificate,
                clientPrivateKey,
                securityMode: MessageSecurityMode.Sign,
                securityPolicy,
                serverCertificate,
                serverPrivateKey
                //   shouldFailAtClientConnection: false,
            },
            done
        );
    }

    it("RR-client & server channel  - with security ", (done) => {
        performTest1(2048, 2048, SecurityPolicy.Basic128Rsa15, done);
    });

    it("client & server channel  - A", (done) => {
        performTest1(2048, 2048, SecurityPolicy.Basic128Rsa15, done);
    });

    for (const sizeC of [1024, 2048, 3072, 4096]) {
        for (const sizeS of [1024, 2048, 3072, 4096]) {
            for (const policy of [
                SecurityPolicy.Basic128Rsa15,
                // xx SecurityPolicy.Basic128,
                // Xx SecurityPolicy.Basic192,
                // Xs SecurityPolicy.Basic192Rsa15,
                SecurityPolicy.Basic256Sha256,
                SecurityPolicy.Aes128_Sha256_RsaOaep,
                SecurityPolicy.Aes256_Sha256_RsaPss,
                SecurityPolicy.Basic256
            ]) {
                it("client & server channel  - " + sizeC + " " + sizeS + " " + policy, (done) => {
                    performTest1(sizeC, sizeS, policy, done);
                });
            }
        }
    }
});
