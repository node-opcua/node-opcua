#!/usr/bin/env ts-node
import fs from "fs";
import path from "path";
import util from "util";
import { types } from "util";
import yargs from "yargs/yargs";
import chalk from "chalk";
import Table from "easy-table";

import {
    ApplicationType,
    assert,
    AttributeIds,
    BrowseDirection,
    callConditionRefresh,
    ClientMonitoredItem,
    ClientSession,
    ClientSubscription,
    coerceMessageSecurityMode,
    coerceNodeId,
    coerceSecurityPolicy,
    constructEventFilter,
    DataType,
    DataValue,
    dumpEvent,
    hexDump,
    IBasicSessionAsync,
    makeExpandedNodeId,
    makeNodeId,
    MessageSecurityMode,
    NodeClassMask,
    NodeId,
    ObjectTypeIds,
    ofType,
    OPCUAClient,
    OPCUAClientOptions,
    QueryFirstRequestOptions,
    resolveNodeId,
    SecurityPolicy,
    UserIdentityInfo,
    UserTokenType,
    VariableIds,
    Variant
} from "node-opcua";

import { Certificate, toPem } from "node-opcua-crypto";
import { NodeCrawler } from "node-opcua-client-crawler";

const { asTree, TreeObject } = require("treeify");

function w(str: string, l: number): string {
    return str.padEnd(l).substring(0, l);
}

async function enumerateAllConditionTypes(session: ClientSession) {
    const tree: any = {};

    const conditionEventTypes: any = {};

    async function findAllNodeOfType(tree1: any, typeNodeId1: NodeId, browseName: string) {
        const browseDesc1 = {
            nodeId: typeNodeId1,
            referenceTypeId: resolveNodeId("HasSubtype"),

            browseDirection: BrowseDirection.Forward,
            includeSubtypes: true,
            resultMask: 63
        };
        const browseDesc2 = {
            nodeId: typeNodeId1,
            referenceTypeId: resolveNodeId("HasTypeDefinition"),

            browseDirection: BrowseDirection.Inverse,
            includeSubtypes: true,
            resultMask: 63
        };
        const browseDesc3 = {
            nodeId: typeNodeId1,
            referenceTypeId: resolveNodeId("HasTypeDefinition"),

            browseDirection: BrowseDirection.Forward,
            includeSubtypes: true,
            resultMask: 63
        };

        const nodesToBrowse = [browseDesc1, browseDesc2, browseDesc3];
        const browseResults = await session.browse(nodesToBrowse);

        tree1[browseName] = {};
        browseResults[0].references = browseResults[0].references || [];
        const promises = [];
        for (const reference of browseResults[0].references) {
            conditionEventTypes[reference.nodeId.toString()] = reference.browseName.toString();
            promises.push(findAllNodeOfType(tree1[browseName], reference.nodeId, reference.browseName.toString()));
        }
        await Promise.all(promises);
    }

    const typeNodeId = resolveNodeId("ConditionType");

    await findAllNodeOfType(tree, typeNodeId, "ConditionType");

    return tree;
}

async function enumerateAllAlarmAndConditionInstances(session: ClientSession): Promise<any[]> {
    const conditions: any = {};

    const found: any = [];

    function isConditionEventType(nodeId: NodeId): boolean {
        return Object.prototype.hasOwnProperty.call(conditions, nodeId.toString());
    }

    async function exploreForObjectOfType(session1: ClientSession, nodeId: NodeId) {
        async function worker(element: any) {
            const nodeToBrowse = {
                nodeId: element.nodeId,
                referenceTypeId: resolveNodeId("HierarchicalReferences"),

                browseDirection: BrowseDirection.Forward,
                includeSubtypes: true,
                nodeClassMask: 0x1, // Objects
                resultMask: 63
            };

            const browseResult = await session1.browse(nodeToBrowse);

            for (const ref of browseResult.references!) {
                if (isConditionEventType(ref.typeDefinition)) {
                    //
                    const alarm = {
                        parent: element.nodeId,

                        alarmNodeId: ref.nodeId,
                        browseName: ref.browseName,
                        typeDefinition: ref.typeDefinition,
                        typeDefinitionName: conditions[ref.typeDefinition.toString()]
                    };
                    found.push(alarm);
                } else {
                    await worker(ref.nodeId);
                }
            }
        }

        await worker(nodeId);
    }

    await enumerateAllConditionTypes(session);

    await exploreForObjectOfType(session, resolveNodeId("RootFolder"));

    return Object.values(conditions);
}

async function _getAllEventTypes(session: ClientSession, baseNodeId: NodeId, tree: any) {
    const browseDesc1 = {
        nodeId: baseNodeId,
        referenceTypeId: resolveNodeId("HasSubtype"),

        browseDirection: BrowseDirection.Forward,
        includeSubtypes: true,
        nodeClassMask: NodeClassMask.ObjectType, // Objects
        resultMask: 63
    };
    const browseResult = await session.browse(browseDesc1);

    // to do continuation points
    for (const reference of browseResult.references!) {
        const subtree = { nodeId: reference.nodeId.toString() };
        tree[reference.browseName.toString()] = subtree;
        await _getAllEventTypes(session, reference.nodeId, subtree);
    }
}

/**
 * getAllEventType recursively
 */
async function getAllEventTypes(session: ClientSession) {
    const baseNodeId = makeNodeId(ObjectTypeIds.BaseEventType);
    const result = {};
    await _getAllEventTypes(session, baseNodeId, result);
    return result;
}

async function monitorAlarm(session: IBasicSessionAsync, subscription: ClientSubscription, alarmNodeId: NodeId) {
    try {
        await callConditionRefresh(session, subscription.subscriptionId);
    } catch (err) {
        if (types.isNativeError(err)) {
            console.log(" monitorAlarm failed , may be your server doesn't support A&E", err.message);
        }
    }
}

function getTick() {
    return Date.now();
}

(async () => {
    // ts-node bin/simple_client.ts --endpoint  opc.tcp://localhost:53530/OPCUA/SimulationServer --node "ns=5;s=Sinusoid1"
    const argv = await yargs(process.argv.slice(2)).options({
        endpoint: {
            alias: "e",
            demandOption: true,
            string: true,
            describe: "the end point to connect to "
        },
        securityMode: {
            alias: "s",
            default: "None",
            describe: "the security mode (  None Sign SignAndEncrypt )"
        },
        securityPolicy: {
            alias: "P",
            default: "None",
            describe: "the policy mode : (" + Object.keys(SecurityPolicy).join(" - ") + ")"
        },
        userName: {
            alias: "u",
            describe: "specify the user name of a UserNameIdentityToken"
        },
        password: {
            alias: "p",
            describe: "specify the password of a UserNameIdentityToken"
        },
        node: {
            alias: "n",
            describe: "the nodeId of the value to monitor"
        },
        timeout: {
            alias: "t",
            describe: " the timeout of the session in second =>  (-1 for infinity)"
        },
        debug: {
            alias: "d",
            boolean: true,
            describe: " display more verbose information"
        },
        history: {
            alias: "h",
            describe: "make an historical read"
        },
        crawl: {
            alias: "c",
            describe: "crawl"
        },
        discovery: {
            alias: "D",
            describe: "specify the endpoint uri of discovery server (by default same as server endpoint uri)"
        }
    }).argv;

    const securityMode = coerceMessageSecurityMode(argv.securityMode!);
    if (securityMode === MessageSecurityMode.Invalid) {
        throw new Error("Invalid Security mode");
    }

    const securityPolicy = coerceSecurityPolicy(argv.securityPolicy!);
    if (securityPolicy === SecurityPolicy.Invalid) {
        throw new Error("Invalid securityPolicy");
    }

    const timeout = (argv.timeout as number) * 1000 || 20000;

    const monitored_node: NodeId = coerceNodeId((argv.node as string) || makeNodeId(VariableIds.Server_ServerStatus_CurrentTime));

    console.log(chalk.cyan("securityMode        = "), securityMode.toString());
    console.log(chalk.cyan("securityPolicy      = "), securityPolicy.toString());
    console.log(chalk.cyan("timeout             = "), timeout ? timeout : " Infinity ");
    console.log(" monitoring node id = ", monitored_node);

    if (!argv.endpoint) {
        // y.showHelp();
        process.exit(0);
    }
    const discoveryUrl: string = argv.discovery ? (argv.discovery as string) : argv.endpoint || "";

    const doCrawling = !!argv.crawl;
    const doHistory = !!argv.history;

    async function exploreEndpoint(endpointUrl: string): Promise<{ endpointUrl: string; serverCertificate?: Certificate }> {
        const optionsInitial: OPCUAClientOptions = {
            securityMode,
            securityPolicy,

            endpointMustExist: false,
            keepSessionAlive: true,

            connectionStrategy: {
                initialDelay: 2000,
                maxDelay: 10 * 1000,
                maxRetry: 10
            },

            discoveryUrl
        };

        const client = OPCUAClient.create(optionsInitial);

        client.on("backoff", (retry: number, delay: number) => {
            console.log(chalk.bgWhite.yellow("backoff  attempt #"), retry, " retrying in ", delay / 1000.0, " seconds");
        });

        console.log(" connecting to ", chalk.cyan.bold(endpointUrl));
        console.log("    strategy", client.connectionStrategy);

        try {
            await client.connect(endpointUrl);
            console.log(" Connected ! exact endpoint url is ", client.endpointUrl);
        } catch (err) {
            console.log(chalk.red(" Cannot connect to ") + endpointUrl);
            if (types.isNativeError(err)) {
                console.log(" Error = ", err.message);
            }
            throw new Error("Cannot connect to endpoint");
        }

        const endpoints = await client.getEndpoints();

        if (argv.debug) {
            fs.writeFileSync("tmp/endpoints.log", JSON.stringify(endpoints, null, " "));
            console.log(endpoints);
        }

        const table = new Table();

        let serverCertificate: Certificate | undefined;

        let i = 0;
        for (const endpoint of endpoints) {
            table.cell("endpoint", endpoint.endpointUrl + "");
            table.cell("Application URI", endpoint.server.applicationUri);
            table.cell("Product URI", endpoint.server.productUri);
            table.cell("Application Name", endpoint.server.applicationName.text);
            table.cell("Security Mode", MessageSecurityMode[endpoint.securityMode].toString());
            table.cell("securityPolicyUri", endpoint.securityPolicyUri);
            table.cell("Type", ApplicationType[endpoint.server.applicationType]);
            table.cell("certificate", "..." /*endpoint.serverCertificate*/);
            endpoint.server.discoveryUrls = endpoint.server.discoveryUrls || [];
            table.cell("discoveryUrls", endpoint.server.discoveryUrls.join(" - "));

            serverCertificate = endpoint.serverCertificate;

            const certificate_filename = path.join(__dirname, "../certificates/PKI/server_certificate" + i + ".pem");

            if (serverCertificate) {
                fs.writeFile(certificate_filename, toPem(serverCertificate, "CERTIFICATE"), () => {
                    /**/
                });
            }
            table.newRow();
            i++;
        }
        console.log(table.toString());

        for (const endpoint of endpoints) {
            console.log(
                "Identify Token for : Security Mode=",
                endpoint.securityMode.toString(),
                " Policy=",
                endpoint.securityPolicyUri
            );
            const table2 = new Table();
            for (const token of endpoint.userIdentityTokens!) {
                table2.cell("policyId", token.policyId);
                table2.cell("tokenType", token.tokenType.toString());
                table2.cell("issuedTokenType", token.issuedTokenType);
                table2.cell("issuerEndpointUrl", token.issuerEndpointUrl);
                table2.cell("securityPolicyUri", token.securityPolicyUri);
                table2.newRow();
            }
            console.log(table2.toString());
        }
        await client.disconnect();

        // reconnect using the correct end point URL now
        console.log(chalk.cyan("Server Certificate :"));
        console.log(chalk.yellow(hexDump(serverCertificate!)));

        console.log(" adjusted endpoint Url =", client.endpointUrl);

        return { endpointUrl: client.endpointUrl, serverCertificate };
    }

    async function main() {
        const { endpointUrl, serverCertificate } = await exploreEndpoint(argv.endpoint);

        const options = {
            securityMode,
            securityPolicy,

            // we can specify here server certificate
            serverCertificate,

            defaultSecureTokenLifetime: 40000,

            endpointMustExist: false,

            connectionStrategy: {
                initialDelay: 2000,
                maxDelay: 10 * 1000,
                maxRetry: 10
            }
        };
        console.log("Options = ", options.securityMode.toString(), options.securityPolicy.toString());

        const client = OPCUAClient.create(options);

        console.log(" --------------------------------- Now connecting again to ", chalk.cyan.bold(endpointUrl));
        await client.connect(endpointUrl);

        console.log(" Connected ! exact endpoint url is ", client.endpointUrl);
        let userIdentity: UserIdentityInfo = { type: UserTokenType.Anonymous }; // anonymous
        if (argv.userName && argv.password) {
            userIdentity = {
                type: UserTokenType.UserName,

                password: argv.password as string,
                userName: argv.userName as string
            };
        }

        console.log(" now creating Session !");
        const session = await client.createSession(userIdentity);
        client.on("connection_reestablished", () => {
            console.log(chalk.bgWhite.red(" !!!!!!!!!!!!!!!!!!!!!!!!  CONNECTION RE-ESTABLISHED !!!!!!!!!!!!!!!!!!!"));
        });
        console.log(chalk.yellow(" session created"));
        console.log(" sessionId : ", session.sessionId.toString());

        client.on("backoff", (retry: number, delay: number) => {
            console.log(chalk.bgWhite.yellow("backoff  attempt #"), retry, " retrying in ", delay / 1000.0, " seconds");
        });
        client.on("start_reconnection", () => {
            console.log(chalk.bgWhite.red(" !!!!!!!!!!!!!!!!!!!!!!!!  Starting Reconnection !!!!!!!!!!!!!!!!!!!"));
        });

        // -----------------------------------------------------------------------------------------------------------
        //   NAMESPACE
        //   display namespace array
        // -----------------------------------------------------------------------------------------------------------
        const server_NamespaceArray_Id = makeNodeId(VariableIds.Server_NamespaceArray); // ns=0;i=2006

        const dataValue = await session.readVariableValue(server_NamespaceArray_Id);

        console.log(" --- NAMESPACE ARRAY ---");
        const namespaceArray = dataValue.value.value;
        for (const namespace of namespaceArray) {
            console.log(" Namespace ", namespace.index, "  : ", namespace);
        }
        console.log(" -----------------------");

        // -----------------------------------------------------------------------------------------------------------
        //   enumerate all EVENT TYPES
        // -----------------------------------------------------------------------------------------------------------
        const result = await getAllEventTypes(session);
        console.log(chalk.cyan("---------------------------------------------------- All Event Types "));
        console.log(asTree(result, true, true));
        console.log(" -----------------------");

        // -----------------------------------------------------------------------------------------------------------
        //   Node Crawling
        // -----------------------------------------------------------------------------------------------------------
        let t1: number;
        let t2: number;

        function print_stat() {
            t2 = Date.now();
            const str = util.format(
                "R= %d W= %d T=%d t= %d",
                client.bytesRead,
                client.bytesWritten,
                client.transactionsPerformed,
                t2 - t1
            );
            console.log(chalk.yellow.bold(str));
        }

        if (doCrawling) {
            assert(session !== null && typeof session === "object");
            const crawler = new NodeCrawler(session);

            let t5 = Date.now();
            client.on("send_request", () => {
                t1 = Date.now();
            });

            client.on("receive_response", print_stat);

            t5 = Date.now();
            // xx crawler.on("browsed", function (element) {
            // xx     console.log("->",(new Date()).getTime()-t,element.browseName.name,element.nodeId.toString());
            // xx });

            const nodeId = "ObjectsFolder";
            console.log("now crawling object folder ...please wait...");

            const obj = await crawler.read(nodeId);
            console.log(" Time        = ", new Date().getTime() - t5);
            console.log(" read        = ", crawler.readCounter);
            console.log(" browse      = ", crawler.browseCounter);
            console.log(" browseNext  = ", crawler.browseNextCounter);
            console.log(" transaction = ", crawler.transactionCounter);

            crawler.dispose();
        }
        client.removeListener("receive_response", print_stat);

        // -----------------------------------------------------------------------------------------------------------------
        // enumerate all Condition Types exposed by the server
        // -----------------------------------------------------------------------------------------------------------------

        console.log(
            "--------------------------------------------------------------- Enumerate all Condition Types exposed by the server"
        );
        const conditionTree = await enumerateAllConditionTypes(session);
        console.log(asTree(conditionTree, true, true));
        console.log(
            " -----------------------------------------------------------------------------------------------------------------"
        );

        // -----------------------------------------------------------------------------------------------------------------
        // enumerate all objects that have an Alarm & Condition instances
        // -----------------------------------------------------------------------------------------------------------------

        const alarms = await enumerateAllAlarmAndConditionInstances(session);

        console.log(" -------------------------------------------------------------- Alarms & Conditions ------------------------");
        for (const alarm of alarms) {
            console.log(
                "parent = ",
                chalk.cyan(w(alarm.parent.toString(), 30)),
                chalk.green.bold(w(alarm.typeDefinitionName, 30)),
                "alarmName = ",
                chalk.cyan(w(alarm.browseName.toString(), 30)),
                chalk.yellow(w(alarm.alarmNodeId.toString(), 40))
            );
        }
        console.log(
            " -----------------------------------------------------------------------------------------------------------------"
        );

        // -----------------------------------------------------------------------------------------------------------------
        // Testing if server implements QueryFirst
        // -----------------------------------------------------------------------------------------------------------------
        try {
            console.log(" ----------------------------------------------------------  Testing QueryFirst");
            const queryFirstRequest: QueryFirstRequestOptions = {
                view: {
                    viewId: NodeId.nullNodeId
                },

                nodeTypes: [
                    {
                        typeDefinitionNode: makeExpandedNodeId("i=58"),

                        includeSubTypes: true,

                        dataToReturn: [
                            {
                                attributeId: AttributeIds.AccessLevel,
                                relativePath: undefined
                            }
                        ]
                    }
                ]
            };

            const queryFirstResult = await session.queryFirst(queryFirstRequest);
            console.log(
                " -----------------------------------------------------------------------------------------------------------------"
            );
        } catch (err) {
            if (types.isNativeError(err)) {
                console.log(" Server is not supporting queryFirst err=", err.message);
            }
        }
        // create Read
        if (doHistory) {
            console.log(" ---------------------------------------------------------- History Read------------------------");
            const now = Date.now();
            const start = now - 1000; // read 1 seconds of history
            const historicalReadResult = await session.readHistoryValue(monitored_node, new Date(start), new Date(now));
            console.log(historicalReadResult.toString());
            console.log(
                " -----------------------------------------------------------------------------------------------------------------"
            );
        }

        // ----------------------------------------------------------------------------------
        // create subscription
        // ----------------------------------------------------------------------------------
        console.log(" ----------------------------------------------------------  Create Subscription ");
        const parameters = {
            maxNotificationsPerPublish: 10,
            priority: 10,
            publishingEnabled: true,
            requestedLifetimeCount: 1000,
            requestedMaxKeepAliveCount: 12,
            requestedPublishingInterval: 2000
        };

        const subscription = await session.createSubscription2(parameters);

        let t = getTick();

        console.log("started subscription :", subscription!.subscriptionId);
        console.log(" revised parameters ");
        console.log(
            "  revised maxKeepAliveCount  ",
            subscription!.maxKeepAliveCount,
            " ( requested ",
            parameters.requestedMaxKeepAliveCount + ")"
        );
        console.log(
            "  revised lifetimeCount      ",
            subscription!.lifetimeCount,
            " ( requested ",
            parameters.requestedLifetimeCount + ")"
        );
        console.log(
            "  revised publishingInterval ",
            subscription!.publishingInterval,
            " ( requested ",
            parameters.requestedPublishingInterval + ")"
        );

        subscription
            .on("internal_error", (err: Error) => {
                console.log(" received internal error", err.message);
            })
            .on("keepalive", () => {
                const t4 = getTick();
                const span = t4 - t;
                t = t4;
                console.log(
                    "keepalive ",
                    span / 1000,
                    "sec",
                    " pending request on server = ",
                    (subscription as any).getPublishEngine().nbPendingPublishRequests
                );
            })
            .on("terminated", () => {
                /* */
            });

        try {
            const results1 = await subscription.getMonitoredItems();
            console.log("MonitoredItems clientHandles", results1.clientHandles);
            console.log("MonitoredItems serverHandles", results1.serverHandles);
        } catch (err) {
            if (types.isNativeError(err)) {
                console.log("Server doesn't seems to implement getMonitoredItems method ", err.message);
            }
        }
        // get_monitored_item

        // monitor_a_variable_node_value
        console.log("Monitoring monitor_a_variable_node_value");

        // ---------------------------------------------------------------
        //  monitor a variable node value
        // ---------------------------------------------------------------
        console.log(" Monitoring node ", monitored_node.toString());
        const monitoredItem = ClientMonitoredItem.create(
            subscription,
            {
                attributeId: AttributeIds.Value,
                nodeId: monitored_node
            },
            {
                discardOldest: true,
                queueSize: 10000,
                samplingInterval: 1000
                // xx filter:  { parameterTypeId: "ns=0;i=0",  encodingMask: 0 },
            }
        );
        monitoredItem.on("initialized", () => {
            console.log("monitoredItem initialized");
        });
        monitoredItem.on("changed", (dataValue1: DataValue) => {
            console.log(monitoredItem.itemToMonitor.nodeId.toString(), " value has changed to " + dataValue1.value.toString());
        });
        monitoredItem.on("err", (err_message: string) => {
            console.log(monitoredItem.itemToMonitor.nodeId.toString(), chalk.red(" ERROR"), err_message);
        });

        const results = await subscription.getMonitoredItems();
        console.log("MonitoredItems clientHandles", results.clientHandles);
        console.log("MonitoredItems serverHandles", results.serverHandles);

        console.log("Monitoring monitor_the_object_events");

        // ---------------------------------------------------------------
        //  monitor the object events
        // ---------------------------------------------------------------

        const baseEventTypeId = "i=2041"; // BaseEventType;
        const serverObjectId = "i=2253";

        const fields = [
            "EventId",
            "EventType",
            "SourceNode",
            "SourceName",
            "Time",
            "ReceiveTime",
            "Message",
            "Severity",

            // ConditionType
            "ConditionClassId",
            "ConditionClassName",
            "ConditionName",
            "BranchId",
            "Retain",
            "EnabledState",
            "Quality",
            "LastSeverity",
            "Comment",
            "ClientUserId",

            // AcknowledgeConditionType
            "AckedState",
            "ConfirmedState",

            // AlarmConditionType
            "ActiveState",
            "InputNode",
            "SuppressedState",

            "HighLimit",
            "LowLimit",
            "HighHighLimit",
            "LowLowLimit",

            "Value"
        ];

        const eventFilter = constructEventFilter(fields, ofType("ConditionType"));

        const event_monitoringItem = ClientMonitoredItem.create(
            subscription,
            {
                attributeId: AttributeIds.EventNotifier,
                nodeId: serverObjectId
            },
            {
                discardOldest: true,
                filter: eventFilter,
                queueSize: 100000
            }
        );

        event_monitoringItem.on("initialized", () => {
            console.log("event_monitoringItem initialized");
        });

        event_monitoringItem.on("changed", (eventFields: Variant[]) => {
            dumpEvent(session, fields, eventFields);
        });

        event_monitoringItem.on("err", (err_message: string) => {
            console.log(chalk.red("event_monitoringItem ", baseEventTypeId, " ERROR"), err_message);
        });

        console.log("--------------------------------------------- Monitoring alarms");
        const alarmNodeId = coerceNodeId("ns=2;s=1:Colours/EastTank?Green");
        await monitorAlarm(session, subscription, alarmNodeId);

        console.log("Starting timer ", timeout);
        if (timeout > 0) {
            // simulate a connection break at t =timeout/2
            setTimeout(() => {
                console.log(chalk.red("  -------------------------------------------------------------------- "));
                console.log(chalk.red("  --                               SIMULATE CONNECTION BREAK        -- "));
                console.log(chalk.red("  -------------------------------------------------------------------- "));
                const socket = (client as any)._secureChannel._transport._socket;
                socket.end();
                socket.emit("error", new Error("ECONNRESET"));
            }, timeout);
        }

        await new Promise((resolve) => process.once("SIGINT", resolve));
        console.log(" user interruption ...");
        console.log(chalk.red.bold(" Received client interruption from user "));
        console.log(chalk.red.bold(" shutting down ..."));

        console.log(" closing session");
        await session.close();
        console.log(" session closed");

        console.log(" Calling disconnect");
        await client.disconnect();
        console.log(chalk.cyan(" disconnected"));

        console.log("success !!   ");
        process.exit(0);
    }

    main();
})();
