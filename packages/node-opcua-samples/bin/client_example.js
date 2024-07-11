#!/usr/bin/env node
/* eslint-disable max-statements */
const fs = require("fs");
const path = require("path");
const util = require("util");
const treeify = require("treeify");
const chalk = require("chalk");
const Table = require("easy-table");
const {
    ApplicationType,
    assert,
    AttributeIds,
    BrowseDirection,
    callConditionRefresh,
    ClientMonitoredItem,
    coerceMessageSecurityMode,
    coerceNodeId,
    coerceSecurityPolicy,
    constructEventFilter,
    dumpEvent,
    hexDump,
    makeExpandedNodeId,
    makeNodeId,
    MessageSecurityMode,
    NodeClassMask,
    NodeId,
    ObjectTypeIds,
    OPCUAClient,
    resolveNodeId,
    SecurityPolicy,
    VariableIds,
    ObjectIds,
    UserTokenType
} = require("node-opcua");
const { toPem } = require("node-opcua-crypto");

//node bin/client_example.js --endpoint  opc.tcp://localhost:53530/OPCUA/SimulationServer --node "ns=5;s=Sinusoid1"
const yargs = require("yargs/yargs");
const argv = yargs(process.argv)
    .wrap(132)
    // .usage("Usage: $0 -d --endpoint <endpointUrl> [--securityMode (None|SignAndEncrypt|Sign)] [--securityPolicy (None|Basic256|Basic128Rsa15)] --node <node_id_to_monitor>")

    .option("endpoint", {
        alias: "e",
        demandOption: true,
        describe: "the end point to connect to "
    })
    .option("securityMode", {
        alias: "s",
        default: "None",
        describe: "the security mode (  None Sign SignAndEncrypt )"
    })
    .option("securityPolicy", {
        alias: "P",
        default: "None",
        describe: "the policy mode : (" + Object.keys(SecurityPolicy).join(" - ") + ")"
    })
    .option("userName", {
        alias: "u",
        describe: "specify the user name of a UserNameIdentityToken"
    })
    .option("password", {
        alias: "p",
        describe: "specify the password of a UserNameIdentityToken"
    })
    .option("node", {
        alias: "n",
        describe: "the nodeId of the value to monitor"
    })
    .option("timeout", {
        alias: "t",
        describe: " the timeout of the session in second =>  (-1 for infinity)"
    })
    .option("debug", {
        alias: "d",
        boolean: true,
        describe: " display more verbose information"
    })
    .option("history", {
        alias: "h",
        describe: "make an historical read"
    })
    .option("discovery", {
        alias: "D",
        describe: "specify the endpoint uri of discovery server (by default same as server endpoint uri)"
    })
    .example("simple_client  --endpoint opc.tcp://localhost:49230 -P=Basic256Rsa256 -s=Sign", "")
    .example("simple_client  -e opc.tcp://localhost:49230 -P=Basic256Sha256 -s=Sign -u JoeDoe -p P@338@rd ", "")
    .example('simple_client  --endpoint opc.tcp://localhost:49230  -n="ns=0;i=2258"', "").argv;

const securityMode = coerceMessageSecurityMode(argv.securityMode);
if (securityMode === MessageSecurityMode.Invalid) {
    throw new Error("Invalid Security mode");
}

const securityPolicy = coerceSecurityPolicy(argv.securityPolicy);
if (securityPolicy === SecurityPolicy.Invalid) {
    throw new Error("Invalid securityPolicy");
}

const timeout = argv.timeout * 1000 || 20000;

const monitored_node = coerceNodeId(argv.node || makeNodeId(VariableIds.Server_ServerStatus_CurrentTime));

console.log(chalk.cyan("securityMode        = "), securityMode.toString());
console.log(chalk.cyan("securityPolicy      = "), securityPolicy.toString());
console.log(chalk.cyan("timeout             = "), timeout ? timeout : " Infinity ");
console.log(" monitoring node id = ", monitored_node);

const endpointUrl = argv.endpoint;

if (!endpointUrl) {
    yargs.showHelp();
    process.exit(0);
}
const discoveryUrl = argv.discovery ? argv.discovery : endpointUrl;

const doHistory = !!argv.history;

function w(str, l) {
    return str.padEnd(l).substring(0, l);
}

async function enumerateAllConditionTypes(session) {
    const tree = {};

    const conditionEventTypes = {};

    async function findAllNodeOfType(tree1, typeNodeId1, browseName) {
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

async function enumerateAllAlarmAndConditionInstances(session) {
    const conditions = {};

    const found = [];

    function isConditionEventType(nodeId) {
        return Object.prototype.hasOwnProperty.call(conditions,nodeId.toString());
    }

    async function exploreForObjectOfType(session1, nodeId) {
        async function worker(element) {
            const nodeToBrowse = {
                nodeId: element.nodeId,
                referenceTypeId: resolveNodeId("HierarchicalReferences"),

                browseDirection: BrowseDirection.Forward,
                includeSubtypes: true,
                nodeClassMask: 0x1, // Objects
                resultMask: 63
            };

            const browseResult = await session1.browse(nodeToBrowse);

            for (const ref of browseResult.references) {
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

async function _getAllEventTypes(session, baseNodeId, tree) {
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
    for (const reference of browseResult.references) {
        const subtree = { nodeId: reference.nodeId.toString() };
        tree[reference.browseName.toString()] = subtree;
        await _getAllEventTypes(session, reference.nodeId, subtree);
    }
}

/**
 * getAllEventType recursively
 */
async function getAllEventTypes(session) {
    const baseNodeId = makeNodeId(ObjectTypeIds.BaseEventType);
    const result = {};
    await _getAllEventTypes(session, baseNodeId, result);
    return result;
}

async function monitorAlarm(session, subscription) {
    try {
        await callConditionRefresh(session, subscription);
    } catch (err) {
        console.log(" monitorAlarm failed , may be your server doesn't support A&E", err.message);
    }
}

function getTick() {
    return Date.now();
}

async function exploreEndpoint(endpointUrl) {
    const optionsInitial = {
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

    client.on("backoff", (retry, delay) => {
        console.log(chalk.bgWhite.yellow("backoff  attempt #"), retry, " retrying in ", delay / 1000.0, " seconds");
    });
    console.log(" connecting to ", chalk.cyan.bold(endpointUrl));
    console.log("    strategy", client.connectionStrategy);

    try {
        await client.connect(endpointUrl);
        console.log(" Connected ! exact endpoint url is ", client.endpointUrl);
    } catch (err) {
        console.log(chalk.red(" Cannot connect to ") + endpointUrl);
        console.log(" Error = ", err.message);
        return;
    }

    const endpoints = await client.getEndpoints();

    if (argv.debug) {
        fs.writeFileSync("tmp/endpoints.log", JSON.stringify(endpoints, null, " "));
        endpoints.forEach((a) => (a.serverCertificate = a.serverCertificate.toString("base64")));
        console.log(treeify.asTree(endpoints, true));
    }

    const table = new Table();

    let serverCertificate;

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
        for (const token of endpoint.userIdentityTokens) {
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
    console.log(chalk.cyan("Server Certificate :"));
    console.log(chalk.yellow(hexDump(serverCertificate)));
    return client.endpointUrl;
}

async function main() {
    // reconnect using the correct end point URL now
    const adjustedEndpointUrl = await exploreEndpoint(endpointUrl);

    const options = {
        securityMode,
        securityPolicy,

        // we provide here server certificate , so it is important to connect with proper endpoint Url
        // serverCertificate,

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

    console.log(" reconnecting to ", chalk.cyan.bold(adjustedEndpointUrl));
    await client.connect(adjustedEndpointUrl);

    console.log(" Connected ! exact endpoint url is ", client.endpointUrl);

    let userIdentity; // anonymous
    if (argv.userName && argv.password) {
        userIdentity = {
            password: argv.password,
            userName: argv.userName,
            type: UserTokenType.UserName
        };
    }

    const session = await client.createSession(userIdentity);
    client.on("connection_reestablished", () => {
        console.log(chalk.bgWhite.red(" !!!!!!!!!!!!!!!!!!!!!!!!  CONNECTION RE-ESTABLISHED !!!!!!!!!!!!!!!!!!!"));
    });
    console.log(chalk.yellow(" session created"));
    console.log(" sessionId : ", session.sessionId.toString());

    client.on("backoff", (retry, delay) => {
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
    const namespaceArray = dataValue.value.value; /*as string[] */
    namespaceArray.forEach((namespace, index) => {
        console.log(" Namespace ", index, "  : ", namespace);
    });
    console.log(" -----------------------");

    // -----------------------------------------------------------------------------------------------------------
    //   enumerate all EVENT TYPES
    // -----------------------------------------------------------------------------------------------------------
    const result = getAllEventTypes(session);
    console.log(chalk.cyan("---------------------------------------------------- All Event Types "));
    console.log(treeify.asTree(result, true));
    console.log(" -----------------------");

    // -----------------------------------------------------------------------------------------------------------------
    // enumerate all Condition Types exposed by the server
    // -----------------------------------------------------------------------------------------------------------------

    console.log(
        "--------------------------------------------------------------- Enumerate all Condition Types exposed by the server"
    );
    const conditionTree = await enumerateAllConditionTypes(session);
    console.log(treeify.asTree(conditionTree));
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
        const queryFirstRequest = {
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

        console.log(
            " -----------------------------------------------------------------------------------------------------------------"
        );
    } catch (err) {
        console.log(" Server is not supporting queryFirst err=", err.message);
    }
    // create Read
    if (doHistory) {
        console.log(" ---------------------------------------------------------- History Read------------------------");
        const now = Date.now();
        const start = now - 1000; // read 1 seconds of history
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

    console.log("started subscription :", subscription.subscriptionId);
    console.log(" revised parameters ");
    console.log(
        "  revised maxKeepAliveCount  ",
        subscription.maxKeepAliveCount,
        " ( requested ",
        parameters.requestedMaxKeepAliveCount + ")"
    );
    console.log(
        "  revised lifetimeCount      ",
        subscription.lifetimeCount,
        " ( requested ",
        parameters.requestedLifetimeCount + ")"
    );
    console.log(
        "  revised publishingInterval ",
        subscription.publishingInterval,
        " ( requested ",
        parameters.requestedPublishingInterval + ")"
    );

    console.log(
        "subscription duration ",
        ((subscription.lifetimeCount * subscription.publishingInterval) / 1000).toFixed(3),
        "seconds"
    );
    subscription
        .on("internal_error", (err) => {
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
                subscription.getPublishEngine().nbPendingPublishRequests
            );
        })
        .on("terminated", () => {
            /* */

            console.log("Subscription is terminated ....");
        });

    try {
        const results1 = await subscription.getMonitoredItems();
        console.log("MonitoredItems clientHandles", results1.clientHandles);
        console.log("MonitoredItems serverHandles", results1.serverHandles);
    } catch (err) {
        console.log("Server doesn't seems to implement getMonitoredItems method ", err.message);
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
    monitoredItem.on("changed", (dataValue1) => {
        console.log(monitoredItem.itemToMonitor.nodeId.toString(), " value has changed to " + dataValue1.value.toString());
    });
    monitoredItem.on("err", (err_message) => {
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

    const eventFilter = constructEventFilter(fields, [resolveNodeId("ConditionType")]);

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

    event_monitoringItem.on("changed", (eventFields) => {
        dumpEvent(session, fields, eventFields);
    });
    event_monitoringItem.on("err", (err_message) => {
        console.log(chalk.red("event_monitoringItem ", baseEventTypeId, " ERROR"), err_message);
    });

    console.log("--------------------------------------------- Monitoring alarms");
    const alarmNodeId = coerceNodeId("ns=2;s=1:Colours/EastTank?Green");
    await monitorAlarm(session, subscription);

    console.log("Starting timer ", timeout);
    if (timeout > 0) {
        // simulate a connection break at t =timeout/2
        // new Promise((resolve) => {
        setTimeout(() => {
            console.log(chalk.red("  -------------------------------------------------------------------- "));
            console.log(chalk.red("  --                               SIMULATE CONNECTION BREAK        -- "));
            console.log(chalk.red("  -------------------------------------------------------------------- "));
            const socket = client._secureChannel.getTransport()._socket;
            socket.end();
            socket.emit("error", new Error("ECONNRESET"));
        }, timeout / 2.0);
        // });
        await new Promise((resolve) => process.once("SIGINT", resolve));
        console.log(" user interruption ...");
    }

    await subscription.terminate();
    await session.close();
    await client.disconnect();
    process.exit(0);
}

main();
