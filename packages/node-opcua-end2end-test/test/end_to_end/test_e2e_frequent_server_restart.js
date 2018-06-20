"use strict";
/* global require, process, __filename, it, before, beforeEach, after, afterEach */
const should = require("should");
const async = require("async");
const _ = require("underscore");
const os = require("os");
const opcua = require("node-opcua");

const doDebug = false;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("NodeRed -  testing frequent server restart within same process", function () {
    /**
     * This test is intending to simulate the way node-red will frequently start and restart
     * a opcua server and a opcua client when the user is modifying and redeploying its project
     * This test verifies that server can be restarted easily and help the nodered-iot-opcua team
     * to elaborate its module
     */

    let g_server = null;


    let discoveryServer;
    let discoveryServerEndpointUrl;
    function startDiscoveryServer(callback) {
        // note : only one discovery server shall be run per machine
        discoveryServer = new opcua.OPCUADiscoveryServer({port: 1240});
        discoveryServerEndpointUrl = discoveryServer._get_endpoints()[0].endpointUrl;
        discoveryServer.start(function(err){
            console.log(" Discovery server listening on ",discoveryServerEndpointUrl);
            callback(err);
        });
    }

    function stopDiscoveryServer(callback) {
        discoveryServer.shutdown(callback);
    }
    let endpointUrl  = "";
    function createServer(callback) {

        const server = new opcua.OPCUAServer({
            registerServerMethod: opcua.RegisterServerMethod.LDS,
            discoveryServerEndpointUrl:discoveryServerEndpointUrl
        });
        // start server with many node
        server.on("serverRegistrationPending",function(){
            console.log("serverRegistrationPending");
        });
        server.on("serverRegistrationRenewed",function(){
            console.log("serverRegistrationRenewed");
        });
        server.on("serverRegistered",function(){
            console.log("serverRegistered");
        });
        server.on("serverUnregistered",function(){
            console.log("serverUnregistered");
        });

        server.start(function(err) {
            if (err) {
                return callback(err);
            }
            g_server = server;

            server.endpoints.length.should.be.greaterThan(0);
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;

            if (doDebug) {
                console.log("Server started");
            }
            callback(err);
        });

    }
    function shutdownServer(callback) {
        g_server.shutdown(function() {
            g_server = null;
            if (doDebug) {
                console.log("Server has been shot down");
            }
            callback();
        });
    }


    before(function(done){
        startDiscoveryServer(done);
    });
    after(function(done){
        stopDiscoveryServer(done);
    });
    it("should perform start/stop cycle efficiently ",function(done) {

        async.series([

            createServer,
            shutdownServer,

            createServer,
            shutdownServer,

            createServer,
            shutdownServer,

            createServer,
            shutdownServer,

            createServer,
            shutdownServer,
        ],done);
    });

    let clients = [];
    function connectManyClient(callback) {


        function addClient(callback) {
            if (doDebug) {
                console.log(" creating client");
            }
            let client = new opcua.OPCUAClient();
            client.connect(endpointUrl,function(err){
                if (err) return callback(err);
                client.createSession(function(err,session) {
                    if (err) return callback(err);
                    client.session = session;
                    clients.push(client);

                    client.subscription =new opcua.ClientSubscription(session,{
                        requestedPublishingInterval: 1000,
                        requestedLifetimeCount: 100,
                        requestedMaxKeepAliveCount: 20,
                        maxNotificationsPerPublish: 100,
                        publishingEnabled: true,
                        priority: 10
                    });
                    client.subscription.on("started",function(){
                        if (doDebug) {
                            console.log("subscription started for 2 seconds - subscriptionId=",client.subscription.subscriptionId);
                        }
                    }).on("keepalive",function(){
                        console.log("keepalive");
                    }).on("terminated",function(){
                    });

                    client.monitoredItem  = client.subscription.monitor({
                            nodeId: opcua.resolveNodeId("ns=0;i=2258"),
                            attributeId: opcua.AttributeIds.Value
                        },
                        {
                            samplingInterval: 100,
                            discardOldest: true,
                            queueSize: 10
                        },
                        opcua.read_service.TimestampsToReturn.Both
                    );
                    client.monitoredItem.on("changed",function(dataValue){
                        if (doDebug) {
                            console.log(dataValue.toString());
                        }
                    });

                    callback(null);
                });
            });
        }
        async.parallel([
            addClient,
            addClient,
            addClient,
            addClient,
            addClient,
            addClient
        ],callback);
    }
    function shutdownClients(callback) {
        function removeClient(callback) {
            const client = clients.pop();

            client.subscription.terminate(function(err) {

                client.session.close(function(err){
                    if (err) return callback(err);
                    setImmediate(function() {
                        client.disconnect(function(err){
                            if (err) return callback(err);

                            if (doDebug) {
                                console.log("Client terminated");
                            }
                            callback();
                        });
                    });
                });
            });
        }
        async.parallel([
            removeClient,
            removeClient,
            removeClient,
            removeClient,
            removeClient,
            removeClient
        ],callback);

    }
    function wait_a_few_seconds(callback){
        setTimeout(callback, 2000);
    }

    function wait_a_minute(callback){
        setTimeout(callback, 3000);
    }

    it("should perform start/stop cycle efficiently even with many connected clients and server close before clients",function(done) {

        async.series([

            createServer,

            connectManyClient,
            wait_a_few_seconds,
            wait_a_few_seconds,

            shutdownServer,

            createServer,
            wait_a_few_seconds,

            shutdownServer,

            createServer,
            wait_a_few_seconds,

            shutdownServer,

            createServer,
            wait_a_few_seconds,

            shutdownServer,

            createServer,
            wait_a_few_seconds,

            shutdownServer,

            shutdownClients,
            wait_a_few_seconds,
        ],done);
    });

    it("should perform start/stop cycle efficiently even with many connected clients and clients close before server",function(done) {

        async.series([

          createServer,

          connectManyClient,
          wait_a_few_seconds,

          shutdownServer,

          createServer,
          wait_a_few_seconds,
          shutdownServer,

          createServer,
          wait_a_few_seconds,

          shutdownClients,
          wait_a_few_seconds,

          shutdownServer,
          wait_a_few_seconds,

        ],done);
    });

    it("should perform start/stop long cycle efficiently even with many connected clients and clients close before server",function(done) {

        async.series([

          createServer,
          wait_a_few_seconds,

          connectManyClient,
          wait_a_few_seconds,
          wait_a_few_seconds,

          shutdownServer,
          wait_a_minute,

          createServer,
          wait_a_minute,

          shutdownClients,
          wait_a_few_seconds,

          shutdownServer,
          wait_a_few_seconds,

        ],done);
    });

    it("NR2 should not crash when a server that failed to start is shot down",function(done) {

        let server1,server2;

        async.series([

           function create_server_1(callback){
                server1= new opcua.OPCUAServer({port:2222});
                server1.start(function(err){
                    callback(err);
                });
           },
            function create_server_2(callback){
                // we start a second server on the same port !
                // this server will fail to start
                server2= new opcua.OPCUAServer({port:2222});
                server2.start(function(err){
                    if (!err) {
                        console.log(" expecting a error here !");
                    }
                    //should.exist(err," server2 must fail to start !( but we ignore the error)");
                    callback();
                });
            },
            function shutdown_server_1(callback){
                server1.shutdown(callback);
            },
            function shutdown_server_2(callback){
                server2.shutdown(function(err){
                    if (!err) {
                        console.log("expecting a error here as well");
                    }
                    //xx should.exist(err,"we expect an error here because server2 failed to start, therefore cannot be shot down");
                    callback();
                });
            }
        ],done);
    });

    it("should not crash when we start two servers and stop the second server first",function(done) {

      let server1,server2;

      async.series([

        function create_server_1(callback){
          server1 = new opcua.OPCUAServer({port:2004});
          server1.start(callback);
        },
        function create_server_2(callback){
            server2 = new opcua.OPCUAServer({port:2018});
            server2.start(callback);
        },
        function shutdown_server_2(callback){
            server2.shutdown(callback);
        },
        function shutdown_server_1(callback){
            server1.shutdown(callback);
        }
      ],done);
    });

    it("should not crash when we start two servers and stop at the same order as we started",function(done) {

      let server1,server2;

      async.series([

        function create_server_1(callback){
          server1 = new opcua.OPCUAServer({port:2014});
          server1.start(callback);
        },
        function create_server_2(callback){
          server2 = new opcua.OPCUAServer({port:2016});
          server2.start(callback);
        },
        function shutdown_server_1(callback){
          server1.shutdown(callback);
        },
        function shutdown_server_2(callback){
          server2.shutdown(callback);
        }
      ],done);
    });
});

