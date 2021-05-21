"use strict";
const chalk = require("chalk");
const should = require("should");
const { assert } = require("node-opcua-assert");
const async = require("async");
const fs = require("fs");
const path = require("path");
const os = require("os");

const {
    OPCUACertificateManager,
    ClientSession,
    ClientSubscription,
    OPCUAClient,
    AttributeIds,
    makeNodeId,
    VariableIds,
    ClientMonitoredItem,
} = require("node-opcua");


const debugLog = require("node-opcua-debug").make_debugLog("TEST");

const port = 2003;
const maxConnectionsPerEndpoint = 100;
const maxAllowedSessionNumber = 50;

const { build_server_with_temperature_device }= require("../test_helpers/build_server_with_temperature_device");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Functional test : one server with many concurrent clients", function () {
    let server, temperatureVariableId, endpointUrl;

    this.timeout(Math.max(500000, this.timeout()));

    let serverCertificateChain = null;
    before((done) => {
        server = build_server_with_temperature_device(
            {
                port,
                maxAllowedSessionNumber: maxAllowedSessionNumber,
                maxConnectionsPerEndpoint: maxConnectionsPerEndpoint
            },
             (err) => {
                endpointUrl = server.getEndpointUrl();
                temperatureVariableId = server.temperatureVariableId;
                serverCertificateChain = server.getCertificateChain();
                debugLog("server started");
                done(err);
            }
        );
    });

    let clientCertificateManager
    before(async () => {

        debugLog("endpointUrl =", endpointUrl);
        const _tmpFolder = fs.mkdtempSync(path.join(os.tmpdir(), "xx"));
        if (!fs.existsSync(_tmpFolder)) {
            fs.mkdirSync(_tmpFolder);
        }
        // const p = path.
        clientCertificateManager = new OPCUACertificateManager({
            rootFolder: _tmpFolder
        });
        await clientCertificateManager.initialize();
    })
    beforeEach(async () => {
        await clientCertificateManager.dispose();
    });

    afterEach((done) => {
        done();
    });

    after((done) => {
        server.shutdown(() => {
            done();
        });
    }); 

    const expectedSubscriptionCount = 0;

    function wait_randomly(callback) {
        setImmediate(()=>setTimeout(callback, Math.ceil(100 + Math.random() * 100)));
    }

    function construct_client_scenario(data) {
        debugLog("construct_client_scenario ", data.name);
        const client = OPCUAClient.create({
            clientCertificateManager,
            serverCertificate: serverCertificateChain,
            requestedSessionTimeout: 120 * 1000 * 100
        });

        data.client = client;
        data.nb_received_changed_event = 0;

        const name = data.name;

        debugLog(" configuring ", data.name);

        const tasks = [
            wait_randomly,

            // connect the client
            function (callback) {
                debugLog(" connection", name);
                client.connect(endpointUrl, function (err) {
                    debugLog(" Connecting client ", name);
                    callback(err);
                });
            },
            wait_randomly,

            // create the session
            function (callback) {
                client.createSession( (err, session) => {
                    debugLog(" session created for ", name);
                    data.session = session;
                    debugLog(chalk.yellow.bold(" Error ="), err);
                    callback(err);
                });
            },

            // wait randomly up to 100 ms
            wait_randomly,

            // create a monitor item
            function (callback) {
                debugLog(" Creating monitored Item for client", name);
                const session = data.session;

                const subscription = ClientSubscription.create(session, {
                    requestedPublishingInterval: 1000,
                    requestedLifetimeCount: 10 * 60 * 10,
                    requestedMaxKeepAliveCount: 10,
                    maxNotificationsPerPublish: 200,
                    publishingEnabled: true,
                    priority: 6
                });

                subscription.on("started", () => {
                    debugLog(
                        chalk.yellow.bold("subscription started"),
                        chalk.cyan(name),
                        expectedSubscriptionCount,
                        server.currentSubscriptionCount
                    );
                });

                subscription.on("terminated", () => {
                    debugLog(chalk.red.bold("subscription terminated"), name);
                });

                const monitoredItem = ClientMonitoredItem.create(
                    subscription,
                    {
                        nodeId: makeNodeId(VariableIds.Server_ServerStatus_CurrentTime),
                        attributeId: AttributeIds.Value
                    },
                    { samplingInterval: 50, discardOldest: true, queueSize: 1 }
                );

                // subscription.on("item_added",function(monitoredItem){
                monitoredItem.on("initialized", () => {
                    //xx console.log("monitoredItem.monitoringParameters.samplingInterval",monitoredItem.monitoringParameters.samplingInterval);//);
                });

                let counter = 0;
                monitoredItem.on("changed", (dataValue) => {
                    debugLog(" client ", name, " received value change ", dataValue.value.value);
                    data.nb_received_changed_event += 1;
                    counter++;
                    if (counter === 2) {
                        callback();
                    }
                });
            },

            // let the client work for a little while
            wait_randomly,

            // closing  session
            function (callback) {
                data.session.close( true, (err) => {
                    debugLog(" closing session for  ", name);
                    callback(err);
                });
            },

            wait_randomly,

            // disconnect the client
            function (callback) {
                client.disconnect(function (err) {
                    debugLog(chalk.cyan("Closing ",name, " disconnected"))
                    callback(err);
                });
            }
        ];
        return tasks;
    }

    it(
        "it should allow " + maxAllowedSessionNumber + " clients to connect and concurrently monitor some nodeId",
        (done) => {
            const nb_clients = server.maxAllowedSessionNumber;

            const clients = [];

            for (let i = 0; i < nb_clients; i++) {
                const data = {};
                data.name = "client " + i;
                data.tasks = construct_client_scenario(data);
                clients.push(data);
            }

            async.mapLimit(
                clients,
                maxAllowedSessionNumber,
                 (data, callback) => {
                    async.series(data.tasks, (err) => {
                        if (err) {
                            console.log(err);
                        }
                        setImmediate(()=>
                            callback(err, data.nb_received_changed_event));
                    });
                },
                (err, results) => {
                    results.forEach( (nb_received_changed_event, index, array) => {
                        nb_received_changed_event.should.be.greaterThan(
                            1,
                            "client " +
                            index +
                            " has received " +
                            nb_received_changed_event +
                            " events ( expecting at least 2)"
                        );
                    });

                    // also check that server has properly closed all subscriptions
                    server.currentSubscriptionCount.should.eql(0);
                    done(err);
                }
            );
        }
    );
});
