"use strict";

const opcua = require("node-opcua");
const should = require("should");
const async = require("async");

const assert = require("node-opcua-assert").assert;

const OPCUAServer = opcua.OPCUAServer;
const OPCUAClient = opcua.OPCUAClient;

const OPCUADiscoveryServer = require("node-opcua-server-discovery").OPCUADiscoveryServer;

const perform_findServers = opcua.perform_findServers;
const perform_findServersOnNetwork = opcua.perform_findServersOnNetwork;

const doDebug = false;

function debugLog()
{
    if (doDebug) {
        console.log.apply(null,arguments);
    }
}

// add the tcp/ip endpoint with no security

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("DS4 - Many discovery servers sharing ServerOnNetworks list", function () {

    let discovery_server1, discovery_server_endpointUrl1;
    let discovery_server2, discovery_server_endpointUrl2;
    let discovery_server3, discovery_server_endpointUrl3;


    before(function () {
        OPCUAServer.registry.count().should.eql(0);
    });

    after(function (done) {
        OPCUAServer.registry.count().should.eql(0);
        done();
    });

    beforeEach(function (done) {
        async.parallel([

            function (callback) {

                discovery_server1 = new OPCUADiscoveryServer({
                    port: 1235,
                    serverInfo: { applicationUri: "urn:localhost:LDS-1235", productUri: "LDS-1235"},
                });
                discovery_server_endpointUrl1 = discovery_server1._get_endpoints()[0].endpointUrl;
                discovery_server1.start(callback);

            },
            function (callback) {

                discovery_server2 = new OPCUADiscoveryServer({
                    port: 1236,
                    serverInfo: { applicationUri: "urn:localhost:LDS-1236", productUri: "LDS-1236"},
                });
                discovery_server_endpointUrl2 = discovery_server2._get_endpoints()[0].endpointUrl;
                discovery_server2.start(callback);

            },
            function (callback) {

                discovery_server3 = new OPCUADiscoveryServer({
                    port: 1237,
                    serverInfo: { applicationUri: "urn:localhost:LDS-1237", productUri: "LDS-1237"},
                });
                discovery_server_endpointUrl3 = discovery_server3._get_endpoints()[0].endpointUrl;
                discovery_server3.start(callback);

            }

        ],done);

    });

    afterEach(function (done) {
        async.parallel([
            function (callback) {
                discovery_server1.shutdown(callback);
            },
            function (callback) {
                discovery_server2.shutdown(callback);
            },
            function (callback) {
                discovery_server3.shutdown(callback);
            }
        ],done);

    });


    it("should register server to the discover server", function (done) {

        // there should be no endpoint exposed by an blank discovery server
        discovery_server1.registeredServerCount.should.equal(0);
        discovery_server2.registeredServerCount.should.equal(0);
        discovery_server3.registeredServerCount.should.equal(0);


        let server1, server2, server3;

        let initialServerCount = 0;
        async.series([

            function (callback) {
                perform_findServers(discovery_server_endpointUrl1, function (err, servers) {
                    initialServerCount = servers.length;
                    servers[0].discoveryUrls.length.should.eql(1);
                    callback(err);
                });
            },

            function (callback) {

                server1 = new OPCUAServer({
                    port: 1300,
                    serverInfo: {applicationUri: "A1", productUri: "A1"},
                    registerServerMethod: opcua.RegisterServerMethod.LDS,
                    discoveryServerEndpointUrl:discovery_server_endpointUrl1
                });
                server1.start(function (err) {
                    if(err) { return callback(err); }
                });

                // server registration takes place in parallel and should be checked independently
                server1.on("serverRegistered",function() {
                    callback();
                });
            },
            function (callback) {
                discovery_server1.registeredServerCount.should.equal(1);
                discovery_server2.registeredServerCount.should.equal(0);
                discovery_server3.registeredServerCount.should.equal(0);
                callback();
            },

            function (callback) {

                server2 = new OPCUAServer({
                    port: 1302,
                    serverInfo: {applicationUri: "A2", productUri: "A2"},
                    registerServerMethod: opcua.RegisterServerMethod.LDS,
                    discoveryServerEndpointUrl:discovery_server_endpointUrl2
                });
                server2.start(function (err) {
                    if(err) { return callback(err); }
                });

                // server registration takes place in parallel and should be checked independently
                server2.on("serverRegistered",function() {
                    callback();
                });
            },


            function (callback) {
                discovery_server1.registeredServerCount.should.equal(1);
                discovery_server2.registeredServerCount.should.equal(1);
                discovery_server3.registeredServerCount.should.equal(0);
                callback();
            },
            function (callback) {

                server3 = new OPCUAServer({
                    port: 1303,
                    serverInfo: {applicationUri: "A3", productUri: "A3"},
                    registerServerMethod: opcua.RegisterServerMethod.LDS,
                    discoveryServerEndpointUrl:discovery_server_endpointUrl3
                });
                server3.start(function (err) {
                    if(err) { return callback(err); }
                });

                // server registration takes place in parallel and should be checked independently
                server3.on("serverRegistered",function() {
                    callback();
                });
            },


            function (callback) {
                discovery_server1.registeredServerCount.should.equal(1);
                discovery_server2.registeredServerCount.should.equal(1);
                discovery_server3.registeredServerCount.should.equal(1);
                callback();
            },

            function (callback) {
                perform_findServers(discovery_server_endpointUrl1, function (err, servers) {

                    servers.length.should.eql(2);
                    servers[0].applicationUri.should.eql("urn:localhost:LDS-1235");
                    servers[1].applicationUri.should.eql("A1");
                    callback(err);
                });
            },
            function (callback) {
                perform_findServers(discovery_server_endpointUrl2, function (err, servers) {
                    debugLog("length = ", servers.length);
                    debugLog("servers[0].applicationUri = ", servers[0].applicationUri);
                    debugLog("servers[1].applicationUri = ", servers[1].applicationUri);
                    servers.length.should.eql(2);
                    servers[0].applicationUri.should.eql("urn:localhost:LDS-1236");
                    servers[1].applicationUri.should.eql("A2");
                    callback(err);
                });
            },
            function (callback) {
                debugLog("xxxxxxx Let bonjour stuff to propagate");
                setTimeout(callback,1000);
            },
            function (callback) {
                debugLog("xxxxxxx Let bonjour stuff to propagate => DOne");
                perform_findServers(discovery_server_endpointUrl3, function (err, servers) {
                    servers.length.should.eql(2);
                    servers[0].applicationUri.should.eql("urn:localhost:LDS-1237");
                    servers[1].applicationUri.should.eql("A3");
                    callback(err);
                });
            },


            function query_discovery_server_for_available_servers_on_network(callback) {
                perform_findServersOnNetwork(discovery_server_endpointUrl1, function (err, servers) {
                    if (doDebug) {
                        for (const s of servers) {
                            debugLog(s.toString());
                        }
                    }
                    servers.length.should.eql(6);
                    debugLog("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
                    callback(err);
                });
            },
            function query_discovery_server_for_available_servers_on_network(callback) {
                perform_findServersOnNetwork(discovery_server_endpointUrl2, function (err, servers) {
                    if (doDebug) {
                        for (const s of servers) {
                            debugLog(s.toString());
                        }
                    }
                    servers.length.should.eql(6);
                    debugLog("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
                    callback(err);
                });
            },
            function query_discovery_server_for_available_servers_on_network(callback) {
                perform_findServersOnNetwork(discovery_server_endpointUrl3, function (err, servers) {
                    if (doDebug) {
                        for (const s of servers) {
                            debugLog(s.toString());
                        }
                    }
                    //xxservers.length.should.eql(6);
                    debugLog("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
                    callback(err);
                });
            },


            function (callback) {
                server1.shutdown(callback);
            },
            function (callback) {
                server2.shutdown(callback);
            },
            function (callback) {
                server3.shutdown(callback);
            },

        ], done);

    });
});

