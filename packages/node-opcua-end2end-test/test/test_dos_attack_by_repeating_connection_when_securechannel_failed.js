/*
 * attempt a DoS attack on Server by consuming SecureChannels and NOT using them.
 *
 */
"use strict";

Error.stackTraceLimit = Infinity;
const chalk = require("chalk");
const path = require("path");
const { readCertificate, readCertificateRevocationList, exploreCertificateInfo } = require("node-opcua-crypto");

require("should");

const debugLog = require("node-opcua-debug").make_debugLog(__filename);
const doDebug = require("node-opcua-debug").checkDebugFlag(__filename) || !!process.env.DEBUG;

const {
    is_valid_endpointUrl,
    MessageSecurityMode,
    SecurityPolicy,
    OPCUAServer,
    OPCUAClient,
    ServerSecureChannelLayer,
    OPCUACertificateManager,

} = require("node-opcua");

const fail_fast_connectionStrategy = {
    maxRetry: 0  // << NO RETRY !!
};
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Server resilience to DDOS attacks 2", function() {


    const invalidCertificateFile = path.join(__dirname, "../certificates/client_cert_2048_outofdate.pem");
    const validCertificate = path.join(__dirname, "../certificates/client_cert_2048.pem");
    const privateKeyFile = path.join(__dirname, "../certificates/client_key_2048.pem");

    let server;
    let endpointUrl;
    const maxConnectionsPerEndpoint = 3;
    const maxAllowedSessionNumber = 10000; // almost no limits

    let clients = [];
    let sessions = [];
    let rejected_connections = 0;

    let port = 2000;

    this.timeout(Math.max(30000000, this.timeout()));
    const remotePorts = {

    }
    function register(remotePort) {
        if (!remotePorts[remotePort]) {
            remotePorts[remotePort] = 1
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

        port += 1;

        console.log(" server port = ", port);
        clients = [];
        sessions = [];
        rejected_connections = 0;


        const serverCertificateManager = new OPCUACertificateManager({
            rootFolder: path.join(__dirname, "../certificates/tmp_pki")
        });
        await serverCertificateManager.initialize();

        const cert = await readCertificate(validCertificate);
        await serverCertificateManager.trustCertificate(cert);

        server = new OPCUAServer({
            port: port,
            maxConnectionsPerEndpoint: maxConnectionsPerEndpoint,
            maxAllowedSessionNumber: maxAllowedSessionNumber,
            //xx nodeset_filename: empty_nodeset_filename
            serverCertificateManager
        });
        console.log("RootFolder = ", server.serverCertificateManager.rootFolder);

        // make sure "that certificate issuer in th*
        const issuerCertificateFile = path.join(__dirname, "../certificates/CA/public/cacert.pem");
        const revokeListFile = path.join(__dirname, "../certificates/CA/crl/revocation_list.crl");

        const issuerCertificate = await readCertificate(issuerCertificateFile);
        const a = exploreCertificateInfo(issuerCertificate);

        const status = await server.serverCertificateManager.addIssuer(issuerCertificate);
        if (status !== "Good" && status !== "BadCertificateUntrusted") {

            console.log("status = ", status);
            console.log("issuerCertificateFile=", issuerCertificateFile);
            console.log(issuerCertificate.toString("base64"));
            throw new Error("Invalid issuer files")
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

        server.on("newChannel", (channel/*: ServerSecureChannelLayer*/) => {
            console.log(">newChannel =>", channel.remotePort, channel.remoteAddress);
            register(channel.remotePort);
        });
        server.on("closeChannel", (channel/*: ServerSecureChannelLayer*/) => {
            console.log("<closeChannel =>", channel.remotePort, channel.remoteAddress);
        });
        server.on("connectionRefused", (socketData, channelData, endpoint) => {
            register(socketData.remotePort);
            console.log("Connection refused", JSON.stringify(socketData));
        });
        server.on("openSecureChannelFailure", (socketData, channelData, endpoint) => {
            if (doDebug) {
                console.log("openSecureChannelFailure", JSON.stringify(socketData),
                    channelData.securityPolicy, MessageSecurityMode[channelData.messageSecurityMode]);
            }
            register(socketData.remotePort);
        });

    });

    afterEach(function(done) {
        server.shutdown(function() {
            server = null;
            done();
        });
    });

    it("ZCCC1 should ban client that constantly reconnect", async () => {

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
        debugLog("new try to connect with a valid certificate => It should work")
        // eslint-disable-next-line no-useless-catch
        try {
            const client = OPCUAClient.create({

                endpointMustExist: false,

                connectionStrategy: fail_fast_connectionStrategy,

                securityPolicy: SecurityPolicy.Basic256Sha256,
                securityMode: MessageSecurityMode.SignAndEncrypt,

                defaultSecureTokenLifetime: 100000,

                certificateFile: validCertificate,
                privateKeyFile,

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
