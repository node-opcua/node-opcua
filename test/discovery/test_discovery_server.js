require("requirish")._(module);

var opcua = require("index");
var should = require("should");
var util = require("util");
var async = require("async");
var _ = require("underscore");
var assert = require("better-assert");

var debugLog = require("lib/misc/utils").make_debugLog(__filename);

var OPCUAServer = opcua.OPCUAServer;
var OPCUADiscoveryServer = require("lib/server/opcua_discovery_server").OPCUADiscoveryServer;
var perform_findServersRequest = require("lib/findservers").perform_findServersRequest;

var crypto_utils = require("lib/misc/crypto_utils");


// add the tcp/ip endpoint with no security
if (!crypto_utils.isFullySupported()) {
    console.log(" SKIPPING TESTS ON SECURE CONNECTION because crypto, please check your installation".red.bold);
} else {

    describe("Discovery server", function () {

        var discovery_server, discovery_server_endpointUrl;

        var server;

        before(function () {
            OPCUAServer.registry.count().should.eql(0);
            server = new OPCUAServer({port: 1235});
            server.serverType = opcua.ApplicationType.SERVER;
        });

        after(function () {
            OPCUAServer.registry.count().should.eql(0);
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


            var client = new opcua.OPCUAClient();
            async.series([
                function (callback) {
                    client.connect(discovery_server_endpointUrl, callback);
                },

                function (callback) {
                    client.performMessageTransaction(registerServerRequest, function (err, response) {
                        if (!err) {
                            // RegisterServerResponse
                            assert(response instanceof opcua.register_server_service.RegisterServerResponse);
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

            var request = new opcua.register_server_service.RegisterServerRequest({
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
            var request = new opcua.register_server_service.RegisterServerRequest({
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

            var request = new opcua.register_server_service.RegisterServerRequest({
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

        it("should register server to the discover server", function (done) {

            // there should be no endpoint exposed by an blank discovery server
            discovery_server.registeredServerCount.should.equal(0);
            var initialServerCount = 0;
            async.series([

                function (callback) {
                    perform_findServersRequest(discovery_server_endpointUrl, function (err, servers) {
                        initialServerCount = servers.length;
                        servers[0].discoveryUrls.length.should.eql(1);
                        console.log(" initialServerCount = ", initialServerCount);
                        console.log("servers[0].discoveryUrls", servers[0].discoveryUrls.join("\n"));
                        callback(err);
                    });
                },

                function (callback) {
                    server.registerServer(discovery_server_endpointUrl, callback);
                },

                function (callback) {
                    discovery_server.registeredServerCount.should.equal(1);
                    callback();
                },

                function (callback) {
                    perform_findServersRequest(discovery_server_endpointUrl, function (err, servers) {
                        console.log(servers[0].toString());
                        servers.length.should.eql(initialServerCount + 1);
                        servers[1].applicationUri.should.eql("urn:NodeOPCUA-Server-default");
                        callback(err);
                    });
                },

                function (callback) {
                    server.unregisterServer(discovery_server_endpointUrl, callback);
                },
                function (callback) {

                    perform_findServersRequest(discovery_server_endpointUrl, function (err, servers) {
                        servers.length.should.eql(initialServerCount);
                        callback(err);
                    });
                }

            ], done);

        });
    });
}


