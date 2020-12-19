"use strict";

const should = require("should");
const async = require("async");
const fs = require("fs");
const path = require("path");
const { assert } = require("node-opcua-assert");

const {
    OPCUAServer,
    OPCUAClient,
    ApplicationType,
    findServers,
    findServersOnNetwork,
    RegisterServerResponse,
    RegisterServerRequest,
    StatusCodes,
    RegisterServerMethod
} = require("node-opcua");
const { OPCUADiscoveryServer } = require("node-opcua-server-discovery");
const {
    readCertificate,
    exploreCertificate,
    readCertificateRevocationList
} = require("node-opcua-crypto");


const debugLog = require("node-opcua-debug").make_debugLog(__filename);
const doDebug = require("node-opcua-debug").checkDebugFlag(__filename);


// add the tcp/ip endpoint with no security

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("DS1 - Discovery server", function() {

    this.timeout(20000);

    let discovery_server, discovery_server_endpointUrl;

    let server;

    before(function() {
        server = new OPCUAServer({ 
            port: 1235 
        });
    });

    after(function(done) {
        server.shutdown(done);
        server = null;
    });

    beforeEach(function(done) {
        discovery_server = new OPCUADiscoveryServer({ port: 1235 });
        discovery_server.start((err) => {
            if (err) {
                return done(err);
            }

            discovery_server_endpointUrl = discovery_server._get_endpoints()[0].endpointUrl;
            debugLog(" discovery_server_endpointUrl = ", discovery_server_endpointUrl);
            setImmediate(done);
        });
    });

    afterEach(function(done) {
        discovery_server.shutdown(done);
        discovery_server = null;
    });

    function send_registered_server_request(discovery_server_endpointUrl, registerServerRequest, externalFunc, done) {


        const client = OPCUAClient.create({
            endpointMustExist: false,
        });
        client.on("backoff", () => {
            console.log("cannot connect to " + discovery_server_endpointUrl);
        });
        async.series([
            function(callback) {
                client.connect(discovery_server_endpointUrl, callback);
            },

            function(callback) {
                client.performMessageTransaction(registerServerRequest, function(err, response) {
                    if (!err) {
                        // RegisterServerResponse
                        assert(response instanceof RegisterServerResponse);
                    }
                    externalFunc(err, response);
                    callback();
                });
            },
            function(callback) {
                setImmediate(() => client.disconnect(callback));
            }
        ], done);
    }

    it("should fail to register server if discovery url is not specified (Bad_DiscoveryUrlMissing)", function(done) {

        const request = new RegisterServerRequest({
            server: {

                // The globally unique identifier for the Server instance. The serverUri matches
                // the applicationUri from the ApplicationDescription defined in 7.1.
                serverUri: "uri:MyServerURI",

                // The globally unique identifier for the Server product.
                productUri: "productUri",

                serverNames: [{ text: "some name" }],

                serverType: ApplicationType.Server,
                gatewayServerUri: null,
                discoveryUrls: [],                 // INTENTIONALLY EMPTY
                semaphoreFilePath: null,
                isOnline: false
            }
        });

        function check_response(err, response) {
            should.not.exist(err);
            //xx console.log(response.toString());
            response.responseHeader.serviceResult.should.eql(StatusCodes.BadDiscoveryUrlMissing);
        }

        send_registered_server_request(discovery_server_endpointUrl, request, check_response, done);

    });

    it("should fail to register server to the discover server if server type is Client (BadInvalidArgument)", function(done) {
        const request = new RegisterServerRequest({
            server: {

                // The globally unique identifier for the Server instance. The serverUri matches
                // the applicationUri from the ApplicationDescription defined in 7.1.
                serverUri: "uri:MyServerURI",

                // The globally unique identifier for the Server product.
                productUri: "productUri",

                serverNames: [{ text: "some name" }],

                serverType: ApplicationType.Client, /// CLIENT HERE !!!
                gatewayServerUri: null,
                discoveryUrls: [],
                semaphoreFilePath: null,
                isOnline: false
            }
        });

        function check_response(err, response) {
            should.not.exist(err);
            //xx debugLog(response.toString());
            response.responseHeader.serviceResult.should.eql(StatusCodes.BadInvalidArgument);
        }

        send_registered_server_request(discovery_server_endpointUrl, request, check_response, done);

    });

    it("should fail to register server to the discover server if server name array is empty (BadServerNameMissing)", function(done) {

        const request = new RegisterServerRequest({
            server: {

                // The globally unique identifier for the Server instance. The serverUri matches
                // the applicationUri from the ApplicationDescription defined in 7.1.
                serverUri: "uri:MyServerURI",

                // The globally unique identifier for the Server product.
                productUri: "productUri",

                serverNames: [],   /// <<<<< INTENTIONALLY EMPTY

                serverType: ApplicationType.Server,
                gatewayServerUri: null,
                discoveryUrls: [],
                semaphoreFilePath: null,
                isOnline: false
            }
        });

        function check_response(err, response) {
            should.not.exist(err);
            response.responseHeader.serviceResult.should.eql(StatusCodes.BadServerNameMissing);
        }

        send_registered_server_request(discovery_server_endpointUrl, request, check_response, done);
    });
});

describe("DS2 - DiscoveryServer2", function() {

    this.timeout(20000);

    let discovery_server, discoveryServerEndpointUrl;
    let server;

    before(function() {
        OPCUAServer.registry.count().should.eql(0);
    });

    after(function(done) {
        OPCUAServer.registry.count().should.eql(0);
        done();
    });
    beforeEach(function(done) {
        discovery_server = new OPCUADiscoveryServer({ port: 1235 });
        discovery_server.start((err) => {
            if (err) {
                return done(err);
            }

            discoveryServerEndpointUrl = discovery_server._get_endpoints()[0].endpointUrl;
            done();
        });
    });

    afterEach(function(done) {
        discovery_server.shutdown(done);
    });

    function addServerCertificateToTrustedCertificateInDiscoveryServer(server, callback) {

        const filename = server.certificateFile;
        fs.existsSync(filename).should.eql(true);
        const certificate = readCertificate(filename);
        discovery_server.serverCertificateManager.trustCertificate(certificate, callback);

    }

    it("should register server to the discover server 2", function(done) {

        // there should be no endpoint exposed by an blank discovery server
        discovery_server.registeredServerCount.should.equal(0);
        let initialServerCount = 0;
        async.series([

            function(callback) {
                findServers(discoveryServerEndpointUrl, (err, data) => {

                    debugLog("data = ", data);
                    const { servers, endpoints } = data;
                    if (err) {
                        return callback(err);
                    }
                    initialServerCount = servers.length;
                    servers[0].discoveryUrls.length.should.eql(1);
                    debugLog(" initialServerCount = ", initialServerCount);
                    debugLog("servers[0].discoveryUrls", servers[0].discoveryUrls.join("\n"));
                    callback(err);
                });
            },

            function(callback) {

                server = new OPCUAServer({
                    port: 1236,
                    registerServerMethod: RegisterServerMethod.LDS,
                    discoveryServerEndpointUrl: discoveryServerEndpointUrl

                });
                addServerCertificateToTrustedCertificateInDiscoveryServer(server, callback);
            },
            function(callback) {
                server.start((err) => {
                    if (err) {
                        return callback(err);
                    }
                });

                // server registration takes place in parallel and should be checked independently
                server.on("serverRegistered", () => {
                    callback();

                });
            },

            function(callback) {
                discovery_server.registeredServerCount.should.equal(1);
                callback();
            },

            function(callback) {
                findServers(discoveryServerEndpointUrl, (err, data) => {
                    const { servers, endpoints } = data;
                    //xx debugLog(servers[0].toString());
                    servers.length.should.eql(initialServerCount + 1);
                    servers[1].applicationUri.should.eql("urn:NodeOPCUA-Server-default");
                    callback(err);
                });
            },

            function(callback) {
                server.shutdown(callback);
            },
            function(callback) {
                findServers(discoveryServerEndpointUrl, (err, data) => {
                    const { servers, endpoints } = data;
                    servers.length.should.eql(initialServerCount);
                    callback(err);
                });
            }

        ], done);

    });
});


process.on("uncaughtException", function(err) {
    console.log(err);
});

describe("DS3 - Discovery server - many server", function() {

    this.timeout(200000);

    let discoveryServer, discoveryServerEndpointUrl;

    let server1, server2, server3, server4, server5;

    before(function() {
        const discoveryServerEndpointUrl = "opc.tcp://localhost:1240";// discovery_server.endpoint[0].endpointUrl;
        OPCUAServer.registry.count().should.eql(0);
        server1 = new OPCUAServer({
            port: 1231,
            serverInfo: { applicationUri: "AA", productUri: "A" },
            registerServerMethod: RegisterServerMethod.LDS,
            discoveryServerEndpointUrl: discoveryServerEndpointUrl
        });
        server2 = new OPCUAServer({
            port: 1232, serverInfo: { applicationUri: "AB", productUri: "B" },
            registerServerMethod: RegisterServerMethod.LDS,
            discoveryServerEndpointUrl: discoveryServerEndpointUrl
        });
        server3 = new OPCUAServer({
            port: 1233,
            serverInfo: { applicationUri: "AC", productUri: "C" },
            registerServerMethod: RegisterServerMethod.LDS,
            discoveryServerEndpointUrl: discoveryServerEndpointUrl
        });
        server4 = new OPCUAServer({
            port: 1234,
            serverInfo: { applicationUri: "AD", productUri: "D" },
            registerServerMethod: RegisterServerMethod.LDS,
            discoveryServerEndpointUrl: discoveryServerEndpointUrl
        });
        server5 = new OPCUAServer({
            port: 1235,
            serverInfo: { applicationUri: "AE", productUri: "E" },
            registerServerMethod: RegisterServerMethod.LDS,
            discoveryServerEndpointUrl: discoveryServerEndpointUrl
        });

        server1.discoveryServerEndpointUrl.should.eql(discoveryServerEndpointUrl);
        server2.discoveryServerEndpointUrl.should.eql(discoveryServerEndpointUrl);
        server3.discoveryServerEndpointUrl.should.eql(discoveryServerEndpointUrl);
        server4.discoveryServerEndpointUrl.should.eql(discoveryServerEndpointUrl);
    });

    after(function(done) {

        OPCUAServer.registry.count().should.eql(0);
        done();
    });

    beforeEach(async () => {
        debugLog("Starting Discovery server on port 1240");
        discoveryServer = new OPCUADiscoveryServer({
            port: 1240
        });
        discoveryServer.serverCertificateManager.automaticallyAcceptUnknownCertificate = true;

        await discoveryServer.start();
        discoveryServerEndpointUrl = discoveryServer._get_endpoints()[0].endpointUrl;

        const issuerCertificateFile = path.join(__dirname, "../../../node-opcua-samples/certificates/CA/public/cacert.pem");
        const issuerCertificateRevocationListFile = path.join(__dirname, "../../../node-opcua-samples/certificates/CA/crl/revocation_list.der");
        const issuerCertificate = await readCertificate(issuerCertificateFile);
        const issuerCrl = await readCertificateRevocationList(issuerCertificateRevocationListFile);

        await discoveryServer.serverCertificateManager.addIssuer(issuerCertificate);
        await discoveryServer.serverCertificateManager.addRevocationList(issuerCrl);
    });


    afterEach(function(done) {
        debugLog("Stopping Discovery server on port 1240");
        discoveryServer.shutdown(function(err) {
            debugLog(" Discovery server on port 1240 stopped");
            done(err);
        });
    });

    let registeredServerCount = 0;

    async function checkServerCertificateAgainsLDS(server) {
        console.log(server.certificateFile);
        const certificate = await server.getCertificate();
        const certIngo = await exploreCertificate(certificate);
        if (doDebug) {
            console.log(certIngo);
        }
        const status = await discoveryServer.serverCertificateManager.verifyCertificate(certificate);
        if (doDebug) {
            console.log(status);
        }
    }
    function start_all_servers(done) {
        registeredServerCount = 0;



        async.parallel([
            function(callback) {
                debugLog("Starting  server1");
                server1.start(callback);
                server1.once("serverRegistered", () => {
                    debugLog("server1 registered");
                    registeredServerCount += 1;
                });

            },
            function(callback) {
                debugLog("Starting  server2");
                server2.start(callback);
                server2.once("serverRegistered", () => {
                    debugLog("server2 registered");
                    registeredServerCount += 1;
                });
            },
            function(callback) {
                debugLog("Starting  server3");
                server3.start(callback);
                server3.once("serverRegistered", () => {
                    debugLog("server3 registered");
                    registeredServerCount += 1;
                });
            },
            function(callback) {
                debugLog("Starting  server4");
                server4.start(callback);
                server4.once("serverRegistered", () => {
                    debugLog("server4 registered");
                    registeredServerCount += 1;
                });
            },
            function(callback) {
                debugLog("Starting  server5");
                server5.start(callback);
                server5.once("serverRegistered", () => {
                    debugLog("server5 registered");
                    registeredServerCount += 1;
                });
            }

        ], done);

    }

    function stop_all_servers(done) {
        async.parallel([
            function(callback) {
                server1.shutdown(callback);
            },
            function(callback) {
                server2.shutdown(callback);
            },
            function(callback) {
                server3.shutdown(callback);
            },
            function(callback) {
                server4.shutdown(callback);
            },
            function(callback) {
                server5.shutdown(callback);
            }
        ], done);
    }


    it("DS3-0 checking certificates", async () => {
        await checkServerCertificateAgainsLDS(server1);
        await checkServerCertificateAgainsLDS(server2);
        await checkServerCertificateAgainsLDS(server3);
        await checkServerCertificateAgainsLDS(server4);
    });

    it("DS3-1 a discovery server shall be able to expose many registered servers", function(done) {


        async.series([
            function(callback) {
                start_all_servers(callback);
            },
            function(callback) {

                function wait_until_all_servers_registered() {
                    if (registeredServerCount === 5) {
                        return callback();
                    }
                    setTimeout(wait_until_all_servers_registered, 500);
                }

                wait_until_all_servers_registered();
            },
            function(callback) {
                discoveryServer.registeredServerCount.should.equal(5);
                callback();
            },

            function wait_a_little_bit_to_let_bonjour_propagate_data(callback) {
                setTimeout(callback, 2000);
            },

            function query_discovery_server_for_available_servers(callback) {

                findServers(discoveryServerEndpointUrl, function(err, data) {
                    const { servers, endpoints } = data;

                    if (doDebug) {
                        for (const s of servers) {
                            debugLog(s.applicationUri, s.productUri, s.applicationType.key, s.discoveryUrls[0]);
                        }
                    }
                    servers.length.should.eql(6); // 5 server + 1 discovery server

                    // servers[1].applicationUri.should.eql("urn:NodeOPCUA-Server-default");
                    callback(err);
                });

            },


            function query_discovery_server_for_available_servers_on_network(callback) {
                findServersOnNetwork(discoveryServerEndpointUrl, function(err, servers) {
                    if (doDebug) {
                        for (const s of servers) {
                            debugLog(s.toString());
                        }
                    }
                    servers.length.should.eql(6, "may be you have a LDS running on your system. please make sure to shut it down before running the tests"); // 5 server + 1 discovery server

                    // servers[1].applicationUri.should.eql("urn:NodeOPCUA-Server-default");
                    callback(err);
                });
            },
            function(callback) {
                stop_all_servers(callback);
            }
        ], done);
    });

});



