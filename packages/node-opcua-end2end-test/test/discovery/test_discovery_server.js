"use strict";

const opcua = require("node-opcua");
const should = require("should");
const async = require("async");

const assert = require("node-opcua-assert").assert;

const OPCUAServer = opcua.OPCUAServer;
const OPCUAClient = opcua.OPCUAClient;

const OPCUADiscoveryServer = require("node-opcua-server-discovery").OPCUADiscoveryServer;

const perform_findServers = opcua.perform_findServers;
const doDebug = false;

// add the tcp/ip endpoint with no security

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("DS1 - Discovery server", function () {

    let discovery_server, discovery_server_endpointUrl;

    let server;

    before(function () {
        OPCUAServer.registry.count().should.eql(0);
        server = new OPCUAServer({port: 1235});
    });

    after(function (done) {
        OPCUAServer.registry.count().should.eql(0);
        server.shutdown(done);
    });

    beforeEach(function (done) {
        discovery_server = new OPCUADiscoveryServer({port: 1235});
        discovery_server_endpointUrl = discovery_server._get_endpoints()[0].endpointUrl;
        discovery_server.start(done);
    });

    afterEach(function (done) {
        discovery_server.shutdown(done);
    });

    function send_registered_server_request(discovery_server_endpointUrl, registerServerRequest, externalFunc, done) {


        const client = new OPCUAClient({});
        async.series([
            function (callback) {
                client.connect(discovery_server_endpointUrl, callback);
            },

            function (callback) {
                client.performMessageTransaction(registerServerRequest, function (err, response) {
                    if (!err) {
                        // RegisterServerResponse
                        assert(response instanceof opcua.discovery_service.RegisterServerResponse);
                    }
                    externalFunc(err, response);
                    callback();
                });
            },
            function (callback) {
                client.disconnect(callback);
            }
        ], done);
    }

    it("should fail to register server if discovery url is not specified (Bad_DiscoveryUrlMissing)", function (done) {

        const request = new opcua.discovery_service.RegisterServerRequest({
            server: {

                // The globally unique identifier for the Server instance. The serverUri matches
                // the applicationUri from the ApplicationDescription defined in 7.1.
                serverUri: "uri:MyServerURI",

                // The globally unique identifier for the Server product.
                productUri: "productUri",

                serverNames: [{text: "some name"}],

                serverType: opcua.ApplicationType.SERVER,
                gatewayServerUri: null,
                discoveryUrls: [],                 // INTENTIONALLY EMPTY
                semaphoreFilePath: null,
                isOnline: false
            }
        });

        function check_response(err, response) {
            should(err).eql(null);
            //xx console.log(response.toString());
            response.responseHeader.serviceResult.should.eql(opcua.StatusCodes.BadDiscoveryUrlMissing);
        }

        send_registered_server_request(discovery_server_endpointUrl, request, check_response, done);

    });

    it("should fail to register server to the discover server if server type is Client (BadInvalidArgument)", function (done) {
        const request = new opcua.discovery_service.RegisterServerRequest({
            server: {

                // The globally unique identifier for the Server instance. The serverUri matches
                // the applicationUri from the ApplicationDescription defined in 7.1.
                serverUri: "uri:MyServerURI",

                // The globally unique identifier for the Server product.
                productUri: "productUri",

                serverNames: [{text: "some name"}],

                serverType: opcua.ApplicationType.CLIENT, /// CLIENT HERE !!!
                gatewayServerUri: null,
                discoveryUrls: [],
                semaphoreFilePath: null,
                isOnline: false
            }
        });

        function check_response(err, response) {
            should(err).eql(null);
            //xx console.log(response.toString());
            response.responseHeader.serviceResult.should.eql(opcua.StatusCodes.BadInvalidArgument);
        }

        send_registered_server_request(discovery_server_endpointUrl, request, check_response, done);

    });

    it("should fail to register server to the discover server if server name array is empty (BadServerNameMissing)", function (done) {

        const request = new opcua.discovery_service.RegisterServerRequest({
            server: {

                // The globally unique identifier for the Server instance. The serverUri matches
                // the applicationUri from the ApplicationDescription defined in 7.1.
                serverUri: "uri:MyServerURI",

                // The globally unique identifier for the Server product.
                productUri: "productUri",

                serverNames: [],   /// <<<<< INTENTIONALLY EMPTY

                serverType: opcua.ApplicationType.SERVER,
                gatewayServerUri: null,
                discoveryUrls: [],
                semaphoreFilePath: null,
                isOnline: false
            }
        });

        function check_response(err, response) {
            should(err).eql(null);
            //xx console.log(response.toString());
            response.responseHeader.serviceResult.should.eql(opcua.StatusCodes.BadServerNameMissing);
        }
        send_registered_server_request(discovery_server_endpointUrl, request, check_response, done);
    });
});

describe("DS2 - DiscoveryServer2", function () {

    let discovery_server, discoveryServerEndpointUrl;
    let server;

    before(function () {
        OPCUAServer.registry.count().should.eql(0);
    });

    after(function (done) {
        OPCUAServer.registry.count().should.eql(0);
        done();
    });
    beforeEach(function (done) {
        discovery_server = new OPCUADiscoveryServer({port: 1235});
        discoveryServerEndpointUrl = discovery_server._get_endpoints()[0].endpointUrl;
        discovery_server.start(done);
    });

    afterEach(function (done) {
        discovery_server.shutdown(done);
    });

    it("should register server to the discover server", function (done) {

        // there should be no endpoint exposed by an blank discovery server
        discovery_server.registeredServerCount.should.equal(0);
        let initialServerCount = 0;
        async.series([

            function (callback) {
                perform_findServers(discoveryServerEndpointUrl, function (err, servers) {
                    initialServerCount = servers.length;
                    servers[0].discoveryUrls.length.should.eql(1);
                    //xx console.log(" initialServerCount = ", initialServerCount);
                    //xx console.log("servers[0].discoveryUrls", servers[0].discoveryUrls.join("\n"));
                    callback(err);
                });
            },

            function (callback) {

                server = new OPCUAServer({
                    port: 1236,
                    registerServerMethod: opcua.RegisterServerMethod.LDS,
                    discoveryServerEndpointUrl:discoveryServerEndpointUrl

                });
                server.start(function (err) {
                    if(err) { return callback(err); }
                });

                // server registration takes place in parallel and should be checked independently
                server.on("serverRegistered",function() {
                    callback();
                });
            },

            function (callback) {
                discovery_server.registeredServerCount.should.equal(1);
                callback();
            },

            function (callback) {
                perform_findServers(discoveryServerEndpointUrl, function (err, servers) {
                    //xx console.log(servers[0].toString());
                    servers.length.should.eql(initialServerCount + 1);
                    servers[1].applicationUri.should.eql("urn:NodeOPCUA-Server-default");
                    callback(err);
                });
            },

            function (callback) {
                server.shutdown(callback);
            },
            function (callback) {
                perform_findServers(discoveryServerEndpointUrl, function (err, servers) {
                    servers.length.should.eql(initialServerCount);
                    callback(err);
                });
            },

        ], done);

    });
});

describe("DS3 - Discovery server - many server", function () {

    this.timeout(200000);

    let discoveryServer, discoveryServerEndpointUrl;

    let server1, server2, server3, server4, server5;

    before(function () {
        const discoveryServerEndpointUrl = "opc.tcp://localhost:1240";// discovery_server.endpoint[0].endpointUrl;
        OPCUAServer.registry.count().should.eql(0);
        server1 = new OPCUAServer({
            port: 1231,
            serverInfo: {applicationUri: "AA", productUri: "A"},
            registerServerMethod: opcua.RegisterServerMethod.LDS,
            discoveryServerEndpointUrl:discoveryServerEndpointUrl
        });
        server2 = new OPCUAServer({
            port: 1232, serverInfo: {applicationUri: "AB", productUri: "B"},
            registerServerMethod: opcua.RegisterServerMethod.LDS,
            discoveryServerEndpointUrl:discoveryServerEndpointUrl
        });
        server3 = new OPCUAServer({
            port: 1233,
            serverInfo: {applicationUri: "AC", productUri: "C"},
            registerServerMethod: opcua.RegisterServerMethod.LDS,
            discoveryServerEndpointUrl:discoveryServerEndpointUrl
        });
        server4 = new OPCUAServer({
            port: 1234,
            serverInfo: {applicationUri: "AD", productUri: "D"},
            registerServerMethod: opcua.RegisterServerMethod.LDS,
            discoveryServerEndpointUrl:discoveryServerEndpointUrl
        });
        server5 = new OPCUAServer({
            port: 1235,
            serverInfo: {applicationUri: "AE", productUri: "E"},
            registerServerMethod: opcua.RegisterServerMethod.LDS,
            discoveryServerEndpointUrl:discoveryServerEndpointUrl
        });
        server1.discoveryServerEndpointUrl.should.eql(discoveryServerEndpointUrl);
        server2.discoveryServerEndpointUrl.should.eql(discoveryServerEndpointUrl);
        server3.discoveryServerEndpointUrl.should.eql(discoveryServerEndpointUrl);
        server4.discoveryServerEndpointUrl.should.eql(discoveryServerEndpointUrl);
    });

    after(function (done) {

        OPCUAServer.registry.count().should.eql(0);
        done();
    });

    beforeEach(function (done) {
        discoveryServer = new OPCUADiscoveryServer({port: 1240});
        discoveryServerEndpointUrl = discoveryServer._get_endpoints()[0].endpointUrl;
        discoveryServer.start(done);
    });

    afterEach(function (done) {
        discoveryServer.shutdown(function (err) {
            done(err);
        });
    });

    function start_all_servers(done) {
        async.parallel([
            function (callback) {
                server1.start(callback);
            },
            function (callback) {
                server2.start(callback);
            },
            function (callback) {
                server3.start(callback);
            },
            function (callback) {
                server4.start(callback);
            },
            function (callback) {
                server5.start(callback);
            },

        ], done);

    }

    function stop_all_servers(done) {
        async.parallel([
            function (callback) {
                server1.shutdown(callback);
            },
            function (callback) {
                server2.shutdown(callback);
            },
            function (callback) {
                server3.shutdown(callback);
            },
            function (callback) {
                server4.shutdown(callback);
            },
            function (callback) {
                server5.shutdown(callback);
            },
        ], done);
    }


    it("a discovery server shall be able to expose many registered servers", function (done) {

        async.series([
            function (callback) {
                start_all_servers(callback);
            },
            function (callback){
                setTimeout(callback,1000);
            },
            function (callback) {
                discoveryServer.registeredServerCount.should.equal(5);
                callback();
            },

            function query_discovery_server_for_available_servers(callback) {
                perform_findServers(discoveryServerEndpointUrl, function (err, servers) {
                    //xxconsole.log(servers[0].toString());
                    ///servers.length.should.eql(4+ 1);
                    if (doDebug) {
                        for (const s of servers) {
                            console.log(s.applicationUri, s.productUri, s.applicationType.key, s.discoveryUrls[0]);
                        }
                    }

                    // servers[1].applicationUri.should.eql("urn:NodeOPCUA-Server-default");
                    callback(err);
                });
            },
            function (callback) {
                stop_all_servers(callback);
            }
        ], done)
    });
});



