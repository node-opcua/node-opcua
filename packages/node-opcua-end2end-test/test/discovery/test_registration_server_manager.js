"use strict";

const opcua = require("node-opcua");
const should = require("should");
const async = require("async");


const OPCUAServer = opcua.OPCUAServer;

const OPCUADiscoveryServer = require("node-opcua-server-discovery").OPCUADiscoveryServer;


// add the tcp/ip endpoint with no security

function f(func,callback) {
    func(callback);
}
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("DS6- Discovery server", function () {

    this.timeout(20000);
    let discoveryServer, discoveryServerEndpointUrl;

    let server;

    function start_discovery_server(callback) {
        discoveryServer.start(callback);
    }

    function stop_discovery_server(callback) {
        discoveryServer.shutdown(callback);
    }

    before(function () {
        OPCUAServer.registry.count().should.eql(0);

        discoveryServer = new OPCUADiscoveryServer({port: 1240});
        discoveryServerEndpointUrl = discoveryServer._get_endpoints()[0].endpointUrl;
    });
    after(function (done) {
        OPCUAServer.registry.count().should.eql(0);
        done();
    });

    beforeEach(function (done) {
        done();
    });

    afterEach(function (done) {
        done();
    });

    it("a server shall register itself to the LDS when the LDS comes online", function (done) {
        async.series([
            // given a up and running LDS
            start_discovery_server.bind(),
            function (callback) {
                server = new OPCUAServer({
                    port: 1435,
                    registerServerMethod: opcua.RegisterServerMethod.LDS,
                    discoveryServerEndpointUrl:discoveryServerEndpointUrl
                });
                server.registerServerManager.timeout = 100;
                // when server starts
                // it should end up registering itself to the LDS
                server.once("serverRegistered", function () {
                    //xx console.log("server serverRegistered");
                    callback();
                });
                server.start(function () {
                });
            },
            function (callback) {
                // when the server shuts down
                // it should unregistered itself from the LDS
                server.once("serverUnregistered", function () {
                    //xx console.log("server serverUnregistered");
                });
                server.shutdown(function () {
                    callback();
                });
            },
            stop_discovery_server.bind()
        ], done);
    });

    it("a server shall register itself on a regular basic to the LDS", function (done) {
        async.series([
            // given a up and running LDS
            start_discovery_server.bind(),
            function (callback) {
                server = new OPCUAServer({
                    port: 1435,
                    registerServerMethod: opcua.RegisterServerMethod.LDS,
                    discoveryServerEndpointUrl:discoveryServerEndpointUrl
                });
                server.registerServerManager.timeout = 100;
                // when server starts
                // it should end up registering itself to the LDS
                server.once("serverRegistered", function () {
                    //xx console.log("server serverRegistered");
                    callback();
                });
                server.start(function () {
                });
            },
            function (callback) {
                server.once("serverRegistrationRenewed", function () {
                    //xx console.log("server serverRegistrationRenewed");
                    callback();
                });
            },
            function (callback) {
                server.once("serverRegistrationRenewed", function () {
                    //xx console.log("server serverRegistrationRenewed");
                    callback();
                });
            },
            function (callback) {
                // when the server shuts down
                // it should unregistered itself from the LDS
                server.once("serverUnregistered", function () {
                    //xx console.log("server serverUnregistered");
                });
                server.shutdown(function () {
                    callback();
                });
            },
            stop_discovery_server.bind()
        ], done);

    });

    it("a server shall try to register itself even if discovery server is not available", function (done) {
        async.series([

            // given a server that starts before the LDS
            function (callback) {
                server = new OPCUAServer({
                    port: 1435,
                    registerServerMethod: opcua.RegisterServerMethod.LDS,
                    discoveryServerEndpointUrl:discoveryServerEndpointUrl
                });
                server.registerServerManager.timeout = 100;
                // when server starts
                // it should end up registering itself to the LDS
                server.start(function () {
                });
                server.once("serverRegistrationPending", function () {
                    //xx console.log("server serverRegistrationPending");
                    callback();
                });
            },
            function(callback){
                server.once("serverRegistrationPending", function () {
                    //xx console.log("server serverRegistrationPending");
                    callback();
                });

            },
            // when discovery server starts ....
            start_discovery_server.bind(),

            function(callback){
                server.once("serverRegistered", function () {
                    //xx console.log("server serverRegistered");
                    callback();
                });
            },

            function (callback) {
                server.once("serverRegistrationRenewed", function () {
                    //xx console.log("server serverRegistrationRenewed");
                    callback();
                });
            },
            function (callback) {
                server.once("serverRegistrationRenewed", function () {
                    //xx console.log("server serverRegistrationRenewed");
                    callback();
                });
            },
            function (callback) {
                // when the server shuts down
                // it should unregistered itself from the LDS
                server.once("serverUnregistered", function () {
                    //xx console.log("server serverUnregistered");
                });
                server.shutdown(function () {
                    callback();
                });
            },
            stop_discovery_server.bind()
        ], done);

    });

    it("a server shall be able not to register itself to the LDS if needed to be hidden", function(done){
        async.series([

            function (callback) {
                server = new OPCUAServer({
                    port: 1435,
                    registerServerMethod: opcua.RegisterServerMethod.HIDDEN,

                });
                server.registerServerManager.timeout = 100;
                server.start(function () {
                    callback();
                });
            },
            function (callback) {
                server.shutdown(function () {
                    callback();
                });
            },
        ], done);

    });
    it("a server (that want to register itself to the LDS) shall be able to start promptly even if the LDS is no available", function(done){
       this.timeout(5000);
       async.series([

            function (callback) {
                server = new OPCUAServer({
                    port: 1435,
                    registerServerMethod: opcua.RegisterServerMethod.LDS,
                    discoveryServerEndpointUrl:discoveryServerEndpointUrl

                });
                server.registerServerManager.timeout = 100;
                server.start(function () {
                    callback();
                });
            },
            function (callback) {
                server.shutdown(function () {
                    callback();
                });
            },
        ], done);

    });

});

describe("DS7- Discovery Server 2",function() {
    it("Discovery Server - server shall not struggle to start if discovery server is not available",function(done){

        let discoveryServerEndpointUrl = "opc.tcp://localhost:12345";

        let server;
        async.series([

            // no discovery ...

            function(callback){

                server = new OPCUAServer({
                    port: 1435,
                    registerServerMethod: opcua.RegisterServerMethod.LDS,
                    discoveryServerEndpointUrl:discoveryServerEndpointUrl
                });

                server.registerServerManager.timeout = 100;

                // when server starts
                // it should end up registering itself to the LDS
                server.once("serverRegistered", function () {
                    console.log("server serverRegistered ?! this is not what we expect !");
                });
                server.start(function () {
                    callback();
                });
            },
            function(callback) {
                server.shutdown(callback);
            }
        ],done);
    });

    it("Discovery Server - server shall not struggle to start if discovery server is not available",function(done){

        let discoveryServerEndpointUrl = "opc.tcp://localhost:12345";

        let server;
        async.series([

            // no discovery ...

            function(callback){

                server = new OPCUAServer({
                    port: 1435,
                    registerServerMethod: opcua.RegisterServerMethod.LDS,
                    discoveryServerEndpointUrl:discoveryServerEndpointUrl
                });

                server.registerServerManager.timeout = 100;

                // when server starts
                // it should end up registering itself to the LDS
                server.once("serverRegistered", function () {
                    console.log("server serverRegistered ?! this is not what we expect !");
                });
                server.start(function () {
                    callback();
                });
            },


            function(callback){
                server.once("serverRegistrationPending", function () {
                    //x console.log("serverRegistrationPending");
                    setTimeout(callback,1000);
                });
            },
            function(callback) {
                server.shutdown(callback);
            }
        ],done);
    });
});