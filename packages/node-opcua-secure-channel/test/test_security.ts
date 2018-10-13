// luanch with mocha -r ts-node/register test/*.ts
// or compile with  tsc  -t es2017 -m commonjs test\test_security.ts  --outdir toto
import * as async from "async";
import { Socket } from "net";
import {
    Certificate,
    PrivateKey,
    PrivateKeyPEM,
    readCertificate,
    readKeyPem,
    readPrivateKey,
    split_der
} from "node-opcua-crypto";
import { EndpointDescription } from "node-opcua-service-endpoints";
import { DirectTransport } from "node-opcua-transport/dist/test_helpers";
import * as path from "path";
import {
    ClientSecureChannelLayer,
    ClientSecureChannelParent,
    MessageSecurityMode,
    SecurityPolicy,
    ServerSecureChannelLayer,
    ServerSecureChannelParent
} from "../source";

type Callback = (err?: Error) => void;

interface TestParam {
    securityMode: MessageSecurityMode;
    securityPolicy: SecurityPolicy;
    serverCertificate?: Certificate;
    clientCertificate?: Certificate;
    serverPrivateKey?: PrivateKeyPEM;
    clientPrivateKey?: PrivateKeyPEM;
    shouldFailAtClientConnection?: boolean;
}

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing secure client and server connection", () => {

    let directTransport: DirectTransport;
    beforeEach((done) => {

        directTransport = new DirectTransport();
        directTransport.initialize(done);

    });
    afterEach((done) => {
        directTransport.shutdown(done);
    });

    function performTest(param: TestParam, done: (err?: Error) => void) {

        const parentS: ServerSecureChannelParent = {

            getCertificate: function() {

                const chain = this.getCertificateChain();

                const firstCertificateInChain = split_der(chain)[0];
                return firstCertificateInChain!;
            },

            getCertificateChain: () => {
                return param.serverCertificate!;
            },

            getEndpointDescription: (securityMode: MessageSecurityMode, securityPolicy: SecurityPolicy) => {
                return new EndpointDescription({});
            },

            getPrivateKey: () => {
                return param.serverPrivateKey!;
            },
        };

        const serverSChannel: ServerSecureChannelLayer = new ServerSecureChannelLayer({
            defaultSecureTokenLifetime: 0,
            objectFactory: undefined,
            parent: parentS,
            timeout: 0
        });
        serverSChannel.setSecurity(param.securityMode, param.securityPolicy);

        const transportServer = (directTransport.server as any) as Socket;

        const parentC: ClientSecureChannelParent = {

            getCertificate: function() {
                const chain = this.getCertificateChain();
                const firstCertificateInChain = split_der(chain)[0];
                return firstCertificateInChain!;
            },

            getCertificateChain: () => {
                return param.clientCertificate!;
            },

            getPrivateKey: () => {
                return param.clientPrivateKey!;
            },

        };

        const clientChannel: ClientSecureChannelLayer = new ClientSecureChannelLayer({
            connectionStrategy: {
                maxDelay: 100,
                maxRetry: 0,

            },
            defaultSecureTokenLifetime: 1000000,
            parent: parentC,
            securityMode: param.securityMode,
            securityPolicy: param.securityPolicy,
            serverCertificate: param.serverCertificate,
            tokenRenewalInterval: 0,
            transportTimeout: 0,
        });

        serverSChannel.init(transportServer, (err?: Error) => {

        });

        async.series([
            (callback: Callback) => {
                callback();
            },

            (callback: Callback) => {

                clientChannel.create("fake://totot:123", (err?: Error) => {

                    if (param.shouldFailAtClientConnection) {
                        if (!err) {
                            return callback(new Error(" Should have failed here !"));
                        }
                        callback();

                    } else {
                        if (err) {
                            return callback(err);
                        }
                        callback();

                    }
                });
            },

            (callback: Callback) => {
                if (param.shouldFailAtClientConnection) {
                    return callback();
                }
                clientChannel.close(callback);
            },

            (callback: Callback) => {
                serverSChannel.close();
                serverSChannel.dispose();
                callback();
            }
        ], done);

    }

    it("client & server channel  - no security ", (done) => {

        performTest({
            securityMode: MessageSecurityMode.None,
            securityPolicy: SecurityPolicy.None,
            serverCertificate: undefined,
        }, done);

    });

    function performTest1(sizeC: number, sizeS: number, securityPolicy: SecurityPolicy, done: (err?: Error) => void) {
        function m(file: string): string {
            return path.join(__dirname, "../../../packages/node-opcua-end2end-test/certificates/" + file);
        }

        const serverCertificateFile = m(`server_cert_${sizeS}.pem`);
        const serverPrivateKeyFile = m(`server_key_${sizeS}.pem`);
        const serverCertificate = readCertificate(serverCertificateFile);
        const serverPrivateKey = readKeyPem(serverPrivateKeyFile);

        const clientCertificateFile = m(`client_cert_${sizeC}.pem`);
        const clientPrivateKeyFile = m(`client_key_${sizeC}.pem`);
        const clientCertificate = readCertificate(clientCertificateFile);
        const clientPrivateKey = readKeyPem(clientPrivateKeyFile);

        performTest({
            clientCertificate,
            clientPrivateKey,
            securityMode: MessageSecurityMode.Sign,
            securityPolicy,
            serverCertificate,
            serverPrivateKey,
            //   shouldFailAtClientConnection: false,
        }, done);

    }

    it("client & server channel  - with security ", (done) => {
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
                SecurityPolicy.Basic256
            ]) {

                it("client & server channel  - " + sizeC + " " + sizeS + " " + policy, (done) => {
                    performTest1(sizeC, sizeS, policy, done);
                });
            }
        }
    }

});
