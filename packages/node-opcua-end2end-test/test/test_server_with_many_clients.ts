import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import chalk from "chalk";
import {
    AttributeIds,
    type ClientSession,
    MonitoringMode,
    makeNodeId,
    OPCUACertificateManager,
    OPCUAClient,
    type OPCUAServer,
    TimestampsToReturn,
    VariableIds
} from "node-opcua";
import type { Certificate } from "node-opcua-crypto";
import { make_debugLog } from "node-opcua-debug";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import {
    build_server_with_temperature_device,
    type ExtraServerProperties
} from "../test_helpers/build_server_with_temperature_device";
import { wait } from "../test_helpers/utils";

const debugLog = make_debugLog("TEST");

const port = 2003;
const maxConnectionsPerEndpoint = 100;
const maxSessions = 50;

describe("Functional test : one server with many concurrent clients", function (this: Mocha.Runnable) {
    let server: OPCUAServer & ExtraServerProperties;
    let endpointUrl: string;

    this.timeout(Math.max(500000, this.timeout()));

    let serverCertificateChain: Certificate[] | undefined;
    before(async () => {
        server = await build_server_with_temperature_device({
            port,
            serverCapabilities: { maxSessions },
            maxConnectionsPerEndpoint
        });

        endpointUrl = server.getEndpointUrl();
        serverCertificateChain = server.getCertificateChain();
        debugLog("server started");
    });

    let clientCertificateManager: OPCUACertificateManager;

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
    });

    after(async () => {
        await server.shutdown();
        await clientCertificateManager.dispose();
    });

    const expectedSubscriptionCount = 0;

    async function wait_randomly() {
        await wait(Math.ceil(100 + Math.random() * 100));
    }

    interface ClientScenarioData {
        session?: ClientSession;
        client?: OPCUAClient;
        name: string;
        nb_received_changed_event: number;
        tasks?: (() => Promise<void>)[];
    }

    function construct_client_scenario(data: ClientScenarioData) {
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

        const tasks: (() => Promise<void>)[] = [
            wait_randomly,

            // connect the client
            async () => {
                debugLog(" connection", name);
                await client.connect(endpointUrl);
                debugLog(" Connecting client ", name);
            },
            wait_randomly,

            // create the session
            async () => {
                const session = await client.createSession();
                debugLog(" session created for ", name);
                data.session = session;
            },

            // wait randomly up to 100 ms
            wait_randomly,

            // create a monitor item
            async () => {
                debugLog(" Creating monitored Item for client", name);
                const session = data.session;
                if (!session) throw new Error("session is not initialized");
                const subscription = await session.createSubscription2({
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

                const monitoredItem = await subscription.monitor(
                    {
                        nodeId: makeNodeId(VariableIds.Server_ServerStatus_CurrentTime),
                        attributeId: AttributeIds.Value
                    },
                    { samplingInterval: 50, discardOldest: true, queueSize: 1 },
                    TimestampsToReturn.Both,
                    MonitoringMode.Reporting
                );

                // subscription.on("item_added",function(monitoredItem){
                monitoredItem.on("initialized", () => {
                    //xx console.log("monitoredItem.monitoringParameters.samplingInterval",monitoredItem.monitoringParameters.samplingInterval);//);
                });

                let counter = 0;

                await new Promise<void>((resolve) => {
                    monitoredItem.on("changed", (dataValue) => {
                        debugLog(" client ", name, " received value change ", dataValue.value.value);
                        data.nb_received_changed_event += 1;
                        counter++;
                        if (counter === 2) {
                            resolve();
                        }
                    });
                });
            },

            // let the client work for a little while
            wait_randomly,

            // closing  session
            async () => {
                await data.session?.close(true);
            },

            wait_randomly,

            // disconnect the client
            async () => {
                await client.disconnect();
                debugLog(chalk.cyan("Closing ", name, " disconnected"));
            }
        ];
        return tasks;
    }

    it(`it should allow ${maxSessions} clients to connect and concurrently monitor some nodeId`, async () => {
        const nb_clients = server.engine.serverCapabilities.maxSessions;

        const clients: ClientScenarioData[] = [];

        for (let i = 0; i < nb_clients; i++) {
            const data: ClientScenarioData = {
                name: `client ${i}`,
                tasks: [],
                nb_received_changed_event: 0
            };
            data.tasks = construct_client_scenario(data);
            clients.push(data);
        }

        try {
            const results = await Promise.all(
                clients.map(async (data) => {
                    try {
                        // Run tasks in series
                        for (const task of data.tasks || []) {
                            await task();
                        }
                        return data.nb_received_changed_event;
                    } catch (err) {
                        console.log(err);
                        return data.nb_received_changed_event;
                    }
                })
            );

            // Check results
            results.forEach((nb_received_changed_event, index) => {
                if (nb_received_changed_event <= 1) {
                    throw new Error(`Client ${index} has received ${nb_received_changed_event} events (expecting at least 2)`);
                }
            });

            // Check server subscriptions
            if (server.currentSubscriptionCount !== 0) {
                throw new Error(`Expected server.currentSubscriptionCount to be 0, but got ${server.currentSubscriptionCount}`);
            }
        } catch (_err) {}
    });
});
