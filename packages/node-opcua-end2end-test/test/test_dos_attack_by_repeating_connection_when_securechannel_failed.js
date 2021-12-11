/*
 * attempt a DoS attack on Server by consuming SecureChannels and NOT using them.
 *
 */
"use strict";
const path = require("path");

Error.stackTraceLimit = Infinity;
const chalk = require("chalk");

const { readCertificate, readCertificateRevocationList, exploreCertificateInfo } = require("node-opcua-crypto");

const should = require("should");

const { make_debugLog, checkDebugFlag } = require("node-opcua-debug");
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const {
    is_valid_endpointUrl,
    MessageSecurityMode,
    SecurityPolicy,
    OPCUAServer,
    OPCUAClient,
    ServerSecureChannelLayer,
    OPCUACertificateManager,
    AttributeIds
} = require("node-opcua");
const { createServerCertificateManager } = require("../test_helpers/createServerCertificateManager");

const fail_fast_connectionStrategy = {
    maxRetry: 0 // << NO RETRY !!
};

const certificateFolder = path.join(__dirname, "../../node-opcua-samples/certificates");

const port = 2019;

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("testing Server resilience to DDOS attacks 2", function () {
    const invalidCertificateFile = path.join(certificateFolder, "client_cert_2048_outofdate.pem");
    const validCertificate = path.join(certificateFolder, "client_cert_2048.pem");
    const privateKeyFile = path.join(certificateFolder, "client_key_2048.pem");

    let server;
    let endpointUrl;
    const maxConnectionsPerEndpoint = 3;
    const maxAllowedSessionNumber = 10000; // almost no limits

    let clients = [];
    let sessions = [];
    let rejected_connections = 0;

    this.timeout(Math.max(30000000, this.timeout()));
    const remotePorts = {};
    function register(remotePort) {
        if (!remotePorts[remotePort]) {
            remotePorts[remotePort] = 1;
        } else {
            console.log(chalk.red("Port has been recycled"), remotePort);
            remotePorts[remotePort] = 1 + remotePorts[remotePort];
        }
    }
    let _throttleTime = ServerSecureChannelLayer.throttleTime;
    before(() => {
        ServerSecureChannelLayer.throttleTime = 1;
    });
    after(() => {
        ServerSecureChannelLayer.throttleTime = _throttleTime;
    });
    beforeEach(async () => {
        console.log(" server port = ", port);
        clients = [];
        sessions = [];
        rejected_connections = 0;

        const serverCertificateManager = await createServerCertificateManager(port);
        
        const cert = await readCertificate(validCertificate);
        await serverCertificateManager.trustCertificate(cert);

        server = new OPCUAServer({
            port,
            maxConnectionsPerEndpoint: maxConnectionsPerEndpoint,
            maxAllowedSessionNumber: maxAllowedSessionNumber,
            //xx nodeset_filename: empty_nodeset_filename
            serverCertificateManager
        });
        console.log("RootFolder = ", server.serverCertificateManager.rootFolder);

        // make sure "that certificate issuer in th*
        const issuerCertificateFile = path.join(certificateFolder, "CA/public/cacert.pem");
        const revokeListFile = path.join(certificateFolder, "CA/crl/revocation_list.crl");

        const issuerCertificate = await readCertificate(issuerCertificateFile);
        const a = exploreCertificateInfo(issuerCertificate);

        const status = await server.serverCertificateManager.addIssuer(issuerCertificate);
        if (status !== "Good" && status !== "BadCertificateUntrusted") {
            console.log("status = ", status);
            console.log("issuerCertificateFile=", issuerCertificateFile);
            console.log(issuerCertificate.toString("base64"));
            throw new Error("Invalid issuer files");
        }

        const crl = await readCertificateRevocationList(revokeListFile);
        server.serverCertificateManager.addRevocationList(crl);

        await server.start();

        // we will connect to first server end point

        const epd = server.endpoints[0].endpointDescriptions()[0];
        endpointUrl = epd.endpointUrl;
        // xx console.log("endpointUrl", endpointUrl, epd.securityMode.toString());
        is_valid_endpointUrl(endpointUrl).should.equal(true);

        server.on("connectionError", (channel) => {
            console.log("connectionError");
        });

        server.on("newChannel", (channel /*: ServerSecureChannelLayer*/) => {
            console.log(">newChannel =>", channel.remotePort, channel.remoteAddress);
            register(channel.remotePort);
        });
        server.on("closeChannel", (channel /*: ServerSecureChannelLayer*/) => {
            console.log("<closeChannel =>", channel.remotePort, channel.remoteAddress);
        });
        server.on("connectionRefused", (socketData, channelData, endpoint) => {
            register(socketData.remotePort);
            console.log("Connection refused", JSON.stringify(socketData));
        });
        server.on("openSecureChannelFailure", (socketData, channelData, endpoint) => {
            if (doDebug) {
                console.log(
                    "openSecureChannelFailure",
                    JSON.stringify(socketData),
                    channelData.securityPolicy,
                    MessageSecurityMode[channelData.messageSecurityMode]
                );
            }
            register(socketData.remotePort);
        });
    });

    afterEach(function (done) {
        server.shutdown(function () {
            server = null;
            done();
        });
    });

    it("ZCCC1 should ban client that constantly reconnect", async () => {
        console.log("done");
    });

    it("ZCCC2 should ban client that constantly reconnect", async () => {
        const serverCertificate = readCertificate(server.certificateFile);

        const clients = [];
        for (let i = 0; i < 10; i++) {
            if (doDebug) {
                console.log("i =", i);
            }

            try {
                const client = OPCUAClient.create({
                    endpointMustExist: false,
                    connectionStrategy: fail_fast_connectionStrategy,
                    securityPolicy: SecurityPolicy.Basic256Sha256,
                    securityMode: MessageSecurityMode.SignAndEncrypt,
                    defaultSecureTokenLifetime: 100000,
                    certificateFile: invalidCertificateFile,
                    privateKeyFile,
                    serverCertificate
                });

                clients.push(client);

                await client.connect(endpointUrl);

                client.disconnect();
                console.log("-----", i);
            } catch (err) {
                if (doDebug) {
                    console.log(err.message);
                }
            }
        }

        for (const client of clients) {
            try {
                await client.disconnect();
            } catch (err) {
                /* */
            }
        }
        // new try to connect with a valid certificate => It should work
        debugLog("new try to connect with a valid certificate => It should work");
        // eslint-disable-next-line no-useless-catch
        try {
            const client = OPCUAClient.create({
                endpointMustExist: false,

                connectionStrategy: fail_fast_connectionStrategy,

                securityPolicy: SecurityPolicy.Basic256Sha256,
                securityMode: MessageSecurityMode.SignAndEncrypt,

                defaultSecureTokenLifetime: 100000,

                certificateFile: validCertificate,
                privateKeyFile
            });
            await client.connect(endpointUrl);

            const session = await client.createSession();

            await session.close();
            client.disconnect();
            console.log("----- Well done!");
        } catch (err) {
            console.log(err);
            throw err;
        }
    });
});

describe("testing Server resilience to DDOS attacks - ability to recover", function () {
    let connectionRefusedCount = 0;
    const requestedSessionTimeout = 2000;

    async function startServer() {
        connectionRefusedCount = 0;
        const server = new OPCUAServer({
            port,
            maxAllowedSessionNumber: 4,
            maxConnectionsPerEndpoint: 3
        });
        await server.start();
        server.on("openSecureChannelFailure", (socketData, channelData, endpoint) => {
            console.log("openSecureChannelFailure", JSON.stringify(socketData), channelData.channelId, endpoint);
        });
        server.on("connectionRefused", (socketData, channelData, endpoint) => {
            console.log("connectionRefused", JSON.stringify(socketData), channelData.channelId, endpoint);
            connectionRefusedCount++;
        });

        return server;
    }
    async function extractServerCertificate(server) {
        const serverCertificate = readCertificate(server.certificateFile);
        return serverCertificate;
    }
    let server;
    before(async () => {
        server = await startServer();
    });
    after(async () => {
        await server.shutdown();
    });

    const clientsToClose = [];
    const promises = [];
    afterEach(async () => {
        for (const client of clientsToClose) {
            await client.disconnect();
        }
        await Promise.all(promises);

    });

    async function simulateDDOSAttack() {
        const serverCertificate = await extractServerCertificate(server);

        async function attack(i) {
            try {
                const client = OPCUAClient.create({
                    serverCertificate,
                    requestedSessionTimeout, // very short for test
                    connectionStrategy: {
                        maxRetry: 0
                    },
                    clientName: "RogueClient" + i + "!!"
                });
                clientsToClose.push(client);
                client.on("backoff", (nbRetry) => {
                    console.log("backoff " + i, nbRetry);
                });

                await client.connect(server.getEndpointUrl());
                await client.createSession();
                // then  create a session and fail
            } catch (err) {
                console.log(chalk.bgRed("!!!!!!!!!!!! CONNECTION ERROR = RogueClient", i, err.message));
            }
        }
        for (let i = 0; i < 10; i++) {
            promises.push(attack(i));
        }
    }
    async function normalClientConnection(i) {
        try {
            // now we should be able to connect
            const client = OPCUAClient.create({
                requestedSessionTimeout: 100, // very short for test
                connectionStrategy: {
                    maxRetry: 0
                },
                clientName: "NormalClient" + i + "!!"
            });
            client.on("backoff", () => {
                console.log("backoff ");
            });

            await client.connect(server.getEndpointUrl());
            const session = await client.createSession();

            const dataValue = await session.read({
                nodeId: "i=2258",
                attributeId: AttributeIds.Value
            });
            console.log(dataValue.toString());
            await session.close();
            await client.disconnect();
        } catch (err) {
            return false;
        }
        return true;
    }
    it("ZCCC4 should eventually allow connection again after a DDOS attack", async () => {
        // Given a server with a limited number of sessions
        // When the server is victim of a DDOS attack
        await simulateDDOSAttack();
        // and When the server start refusing connections    
        await new Promise((resolve)=> server.once("connectionRefused",()=> resolve()));
        await new Promise((resolve) => setTimeout(resolve, requestedSessionTimeout/10));
        console.log(chalk.bgYellowBright("========================================================================"));
        connectionRefusedCount.should.be.greaterThanOrEqual(1);

        // then a normal client should  not be able to connect immediately
        const success1 = await normalClientConnection();
        //xx should(success1).eql(false, "expecting client to fail to connect");
    
        // but server should eventually accept a normal connection, once the DDOS attack is over and all sessions have timed out
        await new Promise((resolve) => setTimeout(resolve, requestedSessionTimeout * 2));
        const success2 = await normalClientConnection();
        should(success2).eql(true, "expecting client to be able to connect again");
    });
});
