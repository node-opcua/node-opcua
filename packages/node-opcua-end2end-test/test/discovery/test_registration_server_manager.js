"use strict";

const opcua = require("node-opcua");
const should = require("should");
const async = require("async");
const chalk = require("chalk");

const debugLog = require("node-opcua-debug").make_debugLog(__filename);
const doDebug = require("node-opcua-debug").checkDebugFlag(__filename);

const OPCUAServer = opcua.OPCUAServer;
const OPCUADiscoveryServer = require("node-opcua-server-discovery").OPCUADiscoveryServer;


// add the tcp/ip endpoint with no security
function f(func) {

    const title = func.name
        .replace(/_/g, " ")
        .replace("given ", chalk.green("**GIVEN** "))
        .replace("when ", chalk.green("**WHEN** "))
        .replace("then ", chalk.green("**THEN** "))
        ;
    const ff = function(callback) {
        console.log("     * " + title);
        func((err) => {
            console.log("     ! " + title);
            callback(err);
        });
    }
    return ff;
}


const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("DS6- Discovery server", function() {

    this.timeout(50000);

    let discoveryServer;
    let discoveryServerEndpointUrl = "opc.tcp://localhost:1240";

    let server;

    function start_discovery_server(callback) {
        discoveryServer.start((err) => {
            discoveryServerEndpointUrl = discoveryServer._get_endpoints()[0].endpointUrl;
            debugLog("discoveryServerEndpointUrl : ", discoveryServerEndpointUrl);
            debugLog("discovery server started");
            callback(err);
        });
    }

    function stop_discovery_server(callback) {
        discoveryServer.shutdown(callback);
    }

    before(function() {
        console.log("discovery url ", discoveryServerEndpointUrl);
        OPCUAServer.registry.count().should.eql(0);

        discoveryServer = new OPCUADiscoveryServer({ port: 1240 });
    });
    after(function(done) {
        stop_discovery_server(() => {
            setTimeout(() => {
                OPCUAServer.registry.count().should.eql(0);
                done();
            }, 1000);
        });
    });

    beforeEach(function(done) {
        done();
    });

    afterEach(function(done) {
        done();
    });

    it("a server shall register itself to the LDS when the LDS comes online", function(done) {
        async.series([
            // given a up and running LDS
            start_discovery_server.bind(),
            function(callback) {

                server = new OPCUAServer({
                    port: 1435,
                    registerServerMethod: opcua.RegisterServerMethod.LDS,
                    discoveryServerEndpointUrl: discoveryServerEndpointUrl
                });
                server.registerServerManager.timeout = 100;
                // when server starts
                // it should end up registering itself to the LDS
                server.once("serverRegistered", function() {
                    //xx console.log("server serverRegistered");
                    callback();
                });
                server.start(function() {
                });
            },
            function(callback) {
                // when the server shuts down
                // it should unregistered itself from the LDS
                server.once("serverUnregistered", function() {
                    //xx console.log("server serverUnregistered");
                });
                server.shutdown(function() {
                    callback();
                });
            },
            stop_discovery_server.bind()
        ], done);
    });

    it("a server shall register itself on a regular basic to the LDS", function(done) {
        async.series([
            // given a up and running LDS
            f(function given_a_local_discovery_server(callback) {
                start_discovery_server(callback);
            }),
            f(function given_a_server_that_register_itself_to_local_discovery(callback) {
                server = new OPCUAServer({
                    port: 1435,
                    registerServerMethod: opcua.RegisterServerMethod.LDS,
                    discoveryServerEndpointUrl: discoveryServerEndpointUrl
                });
                server.registerServerManager.timeout = 100;
                // when server starts
                // it should end up registering itself to the LDS
                server.once("serverRegistered", function() {
                    //xx console.log("server serverRegistered");
                    callback();
                });
                server.start(function() {
                });
            }),
            f(function when_the_server_registration_is_renewed(callback) {
                server.once("serverRegistrationRenewed", function() {
                    //xx console.log("server serverRegistrationRenewed");
                    callback();
                });
            }),
            f(function then_server_registration_should_be_renewed_agin(callback) {
                server.once("serverRegistrationRenewed", function() {
                    //xx console.log("server serverRegistrationRenewed");
                    callback();
                });
            }),
            f(function when_server_shutdown_it_shoud_unregistered_to_lds(callback) {
                // when the server shuts down
                // it should unregistered itself from the LDS
                server.once("serverUnregistered", function() {
                    //xx console.log("server serverUnregistered");
                });
                server.shutdown(function() {
                    callback();
                });
            }),
            stop_discovery_server.bind()
        ], done);

    });

    it("a server shall try to register itself even if discovery server is not available", function(done) {

        async.series([

            // given a server that starts before the LDS
            f(function given_a_opcua_server_trying_to_connect_to_an_not_started_LDS(callback) {
                server = new OPCUAServer({
                    port: 1435,
                    registerServerMethod: opcua.RegisterServerMethod.LDS,
                    discoveryServerEndpointUrl: discoveryServerEndpointUrl
                });
                server.registerServerManager.timeout = 100;
                // when server starts
                // it should end up registering itself to the LDS
                server.start(function() {
                    callback();
                });
            }),
            f(function then_it_should_try_to_connect_to_LDS_and_raise_serverRegistrationPending(callback) {
                server.once("serverRegistrationPending", function() {
                    //xx console.log("server serverRegistrationPending");
                    callback();
                });

            }),
            f(function then_it_should_try_to_connect_to_LDS_and_raise_serverRegistrationPending(callback) {
                server.once("serverRegistrationPending", function() {
                    //xx console.log("server serverRegistrationPending");
                    callback();
                });

            }),
            f(function when_the_lds_is_started(callback) {
                // when discovery server starts ....
                start_discovery_server(callback);
            }),
            f(function then_server_should_finally_manage_to_connect_to_LDS_and_raise_serverRegistered_event(callback) {
                server.once("serverRegistered", function() {
                    //xx console.log("server serverRegistered");
                    callback();
                });
            }),
            f(function then_later_on_server_should_renew_registration_and_raise_serverRegistrationRenewed_event(callback) {
                server.once("serverRegistrationRenewed", function() {
                    //xx console.log("server serverRegistrationRenewed");
                    callback();
                });
            }),
            f(function then_later_on_server_should_renew_registration_and_raise_serverRegistrationRenewed_event(callback) {
                server.once("serverRegistrationRenewed", function() {
                    //xx console.log("server serverRegistrationRenewed");
                    callback();
                });
            }),
            f(function when_server_shutdown_it_should_unregister_itself_from_the_LDS(callback) {
                // when the server shuts down
                // it should unregistered itself from the LDS
                server.once("serverUnregistered", function() {
                    //xx console.log("server serverUnregistered");
                });
                server.shutdown(function() {
                    callback();
                });
            }),
            stop_discovery_server.bind()
        ], done);

    });

    it("a server shall be able not to register itself to the LDS if needed to be hidden", function(done) {
        async.series([

            f(function given_a_server_hidden_from_local_discovery(callback) {
                server = new OPCUAServer({
                    port: 1435,
                    registerServerMethod: opcua.RegisterServerMethod.HIDDEN

                });
                server.registerServerManager.timeout = 100;
                server.start(function() {
                    callback();
                });
            }),
            function(callback) {
                server.shutdown(function() {
                    callback();
                });
            }
        ], done);

    });

    it("a server (that want to register itself to the LDS) shall be able to start promptly even if the LDS is no available", function(done) {
        this.timeout(5000);
        async.series([

            function given_a_server_that_register_itself_to_local_discovery(callback) {
                server = new OPCUAServer({
                    port: 1435,
                    registerServerMethod: opcua.RegisterServerMethod.LDS,
                    discoveryServerEndpointUrl: discoveryServerEndpointUrl

                });
                server.registerServerManager.timeout = 100;
                server.start(function() {
                    callback();
                });
            },
            function(callback) {
                server.shutdown(function() {
                    callback();
                });
            }
        ], done);

    });

});

describe("DS7- Discovery Server 2", function() {
    this.timeout(50000);

    it("DS5-1 server shall not struggle to start if discovery server is not available", function(done) {

        let discoveryServerEndpointUrl = "opc.tcp://localhost:12345";

        let server;
        async.series([

            // in this test, there is no discovery server available
            // no discovery ...

            function(callback) {

                server = new OPCUAServer({
                    port: 1435,
                    registerServerMethod: opcua.RegisterServerMethod.LDS,
                    discoveryServerEndpointUrl: discoveryServerEndpointUrl
                });

                server.registerServerManager.timeout = 100;

                // when server starts
                // it should end up registering itself to the LDS
                server.once("serverRegistered", function() {
                    console.log("server serverRegistered ?! this is not what we expect !");
                });
                server.start(function() {
                    callback();
                });
            },
            function(callback) {
                server.shutdown(callback);
            }
        ], done);
    });

});