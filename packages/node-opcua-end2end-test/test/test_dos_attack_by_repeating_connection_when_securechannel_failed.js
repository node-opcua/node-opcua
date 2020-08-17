/*
 * attempt a DoS attack on Server by consuming SecureChannels and NOT using them.
 *
 */
"use strict";

Error.stackTraceLimit = Infinity;
const chalk = require("chalk");
const path = require("path");
const { readCertificate } = require("node-opcua-crypto");

require("should");

const debugLog = require("node-opcua-debug").make_debugLog(__filename);
const doDebug = require("node-opcua-debug").checkDebugFlag(__filename);

const {
    is_valid_endpointUrl,
    MessageSecurityMode,
    SecurityPolicy,
    OPCUAServer,
    OPCUAClient,
    ServerSecureChannelLayer
} = require("node-opcua");

const fail_fast_connectionStrategy = {
    maxRetry: 0  // << NO RETRY !!
};
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Server resilience to DDOS attacks 2", function() {

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
    beforeEach(function(done) {

        port += 1;

        console.log(" server port = ", port);
        clients = [];
        sessions = [];
        rejected_connections = 0;

        server = new OPCUAServer({
            port: port,
            maxConnectionsPerEndpoint: maxConnectionsPerEndpoint,
            maxAllowedSessionNumber: maxAllowedSessionNumber
            //xx nodeset_filename: empty_nodeset_filename
        });

        server.start(function(err) {
            // we will connect to first server end point

            const epd = server.endpoints[0].endpointDescriptions()[0];
            endpointUrl = epd.endpointUrl;
            console.log("endpointUrl", endpointUrl);
            console.log("epd", epd.securityMode.toString());
            is_valid_endpointUrl(endpointUrl).should.equal(true);
            done(err);
        });

        server.on("connectionError", (channel) => {

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
            console.og("Connection refused", JSON.stringify(socketData));
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

    it("ZCCC should ban client that constantly reconnect", async () => {



        const serverCertificate = readCertificate(server.certificateFile);

        const certificateFile = path.join(__dirname, "../certificates/client_cert_3072_outofdate.pem");
        const validCertificate = path.join(__dirname, "../certificates/client_cert_3072.pem");
        const privateKeyFile = path.join(__dirname, "../certificates/client_key_3072.pem");

        const clients = [];
        for (let i = 0; i < 100; i++) {

            if (doDebug) {
                console.log("i =", i);
            }
            
            try {
                const client = OPCUAClient.create({

                    endpoint_must_exist: false,

                    connectionStrategy: fail_fast_connectionStrategy,

                    securityPolicy: SecurityPolicy.Basic256Sha256,

                    securityMode: MessageSecurityMode.SignAndEncrypt,

                    defaultSecureTokenLifetime: 100000,

                    certificateFile,
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
            } catch(err) {

            }
        }
        // new try to connect with a valid certificate => It should work

        // eslint-disable-next-line no-useless-catch
        try {
            const client = OPCUAClient.create({

                endpoint_must_exist: false,

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
