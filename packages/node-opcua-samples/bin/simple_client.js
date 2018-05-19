#!/usr/bin/env node
"use strict";

const fs = require("fs");
const treeify = require("treeify");
const _ = require("underscore");
const colors = require("colors");
const Table = require("easy-table");
const async = require("async");
const assert = require("node-opcua-assert").assert;
const path = require("path");

const opcua = require("node-opcua");
const VariableIds = opcua.VariableIds;
const BrowseDirection = opcua.BrowseDirection;
const crypto_utils = opcua.crypto_utils;


//node bin/simple_client.js --endpoint  opc.tcp://localhost:53530/OPCUA/SimulationServer --node "ns=5;s=Sinusoid1"
const yargs = require("yargs/yargs");

const argv = yargs(process.argv)
    .wrap(132)
    //.usage("Usage: $0 -d --endpoint <endpointUrl> [--securityMode (NONE|SIGNANDENCRYPT|SIGN)] [--securityPolicy (None|Basic256|Basic128Rsa15)] --node <node_id_to_monitor> --crawl")

    .demand("endpoint")
    .string("endpoint")
    .describe("endpoint", "the end point to connect to ")

    .string("securityMode")
    .describe("securityMode", "the security mode")

    .string("securityPolicy")
    .describe("securityPolicy", "the policy mode")

    .string("userName")
    .describe("userName", "specify the user name of a UserNameIdentityToken ")

    .string("password")
    .describe("password", "specify the password of a UserNameIdentityToken")

    .string("node")
    .describe("node","the nodeId of the value to monitor")

    .string("timeout")
    .describe("timeout"," the timeout of the session in second =>  (-1 for infinity)")

    .string("debug")
    .describe("debug"," display more verbose information")

    .string("history")
    .describe("history","make an historical read")

    .alias("e", "endpoint")
    .alias("s", "securityMode")
    .alias("P", "securityPolicy")
    .alias("u", "userName")
    .alias("p", "password")
    .alias("n", "node")
    .alias("t", "timeout")

    .alias("d", "debug")
    .alias("h", "history")
    .example("simple_client  --endpoint opc.tcp://localhost:49230 -P=Basic256 -s=SIGN")
    .example("simple_client  -e opc.tcp://localhost:49230 -P=Basic256 -s=SIGN -u JoeDoe -p P@338@rd ")
    .example("simple_client  --endpoint opc.tcp://localhost:49230  -n=\"ns=0;i=2258\"")

    .argv;


const securityMode = opcua.MessageSecurityMode.get(argv.securityMode || "NONE");
if (!securityMode) {
    throw new Error("Invalid Security mode , should be " + opcua.MessageSecurityMode.enums.join(" "));
}

const securityPolicy = opcua.SecurityPolicy.get(argv.securityPolicy || "None");
if (!securityPolicy) {
    throw new Error("Invalid securityPolicy , should be " + opcua.SecurityPolicy.enums.join(" "));
}

//xx argv.securityMode   = argv.securityMode || "SIGNANDENCRYPT";
//xx argv.securityPolicy = argv.securityPolicy || "Basic128Rsa15";
const timeout = parseInt(argv.timeout) * 1000 || 20000;

const monitored_node = argv.node || "ns=1;s=PumpSpeed"; //"ns=1;s=Temperature";

console.log("securityMode        = ".cyan, securityMode.toString());
console.log("securityPolicy      = ".cyan, securityPolicy.toString());
console.log("timeout             = ".cyan, timeout ? timeout : " Infinity " );
console.log(" monitoring node id = ", monitored_node);
let client = null;

const endpointUrl = argv.endpoint;


if (!endpointUrl) {
    require("yargs").showHelp();
    process.exit(0);
}

let the_session = null;
let the_subscription = null;
let serverCertificate = null;

const AttributeIds = opcua.AttributeIds;
const DataType = opcua.DataType;

const NodeCrawler = opcua.NodeCrawler;
const doCrawling = !!argv.crawl;
const doHistory = !!argv.history;




function getBrowseName(session,nodeId,callback) {
    session.read({ nodeId: nodeId, attributeId: AttributeIds.BrowseName},function(err, dataValue) {
        if (!err) {
            if (dataValue.statusCode === opcua.StatusCodes.Good) {
                assert(dataValue.statusCode === opcua.StatusCodes.Good);
                const browseName = dataValue.value.value.name;
                return callback(null,browseName);
            }
        }
        callback(err,"<??>");
    });
}

function w(str,l) {
    return (str + "                                      ").substr(0,l);
}



function __dumpEvent(session,fields,eventFields,_callback) {

    assert(_.isFunction(_callback));

    console.log("-----------------------");

    async.forEachOf(eventFields,function(variant,index,callback) {

        assert(_.isFunction(callback));
        if (variant.dataType === DataType.Null) {
            return callback();
        }
        if (variant.dataType === DataType.NodeId)  {

            getBrowseName(session,variant.value,function(err,name){

                if (!err) {
                    console.log(w(name,20),w(fields[index],15).yellow,
                        w(variant.dataType.key,10).toString().cyan,name.cyan.bold,"(",w(variant.value,20),")");
                }
                callback();
            });

        } else {
            setImmediate(function() {
                console.log(w("",20),w(fields[index],15).yellow,
                    w(variant.dataType.key,10).toString().cyan,variant.value);
                callback();
            });
        }
    },_callback);
}

const q = new async.queue(function(task,callback){
    __dumpEvent(task.session,task.fields,task.eventFields,callback);
});

function dumpEvent(session,fields,eventFields,_callback) {

    q.push({
        session: session, fields:fields, eventFields: eventFields, _callback: _callback
    });

}

function enumerateAllConditionTypes(the_session,callback) {

    const tree = {};

    const conditionEventTypes = {};

    function findAllNodeOfType(tree,typeNodeId,browseName,callback) {

        const browseDesc1 = {
            nodeId: typeNodeId,
            referenceTypeId: opcua.resolveNodeId("HasSubtype"),
            browseDirection: BrowseDirection.Forward,
            includeSubtypes: true,
            resultMask: 63

        };
        const browseDesc2 = {
            nodeId: typeNodeId,
            referenceTypeId: opcua.resolveNodeId("HasTypeDefinition"),
            browseDirection: BrowseDirection.Inverse,
            includeSubtypes: true,
            resultMask: 63

        };
        const browseDesc3 = {
            nodeId: typeNodeId,
            referenceTypeId: opcua.resolveNodeId("HasTypeDefinition"),
            browseDirection: BrowseDirection.Forward,
            includeSubtypes: true,
            resultMask: 63

        };

        const nodesToBrowse = [
            browseDesc1,
            browseDesc2,
            browseDesc3
        ];
        the_session.browse(nodesToBrowse,function(err,browseResults) {

            //xx console.log(" exploring".yellow ,browseName.cyan, typeNodeId.toString());
            tree[browseName] = {};
            if (!err) {
                browseResults[0].references = browseResults[0].references || [];
                async.forEach(browseResults[0].references,function(el,_inner_callback) {
                    conditionEventTypes[el.nodeId.toString()] = el.browseName.toString();
                    findAllNodeOfType(tree[browseName],el.nodeId,el.browseName.toString(),_inner_callback);
                }, callback);
            } else {
                callback(err);
            }
        });
    }

    const  typeNodeId = opcua.resolveNodeId("ConditionType");
    findAllNodeOfType(tree,typeNodeId,"ConditionType",function(err){
        if (!err) {
            return callback(null,conditionEventTypes,tree);
        }
        callback(err);
    });
}


function enumerateAllAlarmAndConditionInstances(the_session,callback) {

    let conditions = {};

    const found = [];

    function isConditionEventType(nodeId) {
        return conditions.hasOwnProperty(nodeId.toString());
        //x return derivedType.indexOf(nodeId.toString()) >=0;
    }

    function exploreForObjectOfType(session,nodeId,callback) {


        const q = async.queue(function worker(element,callback){

            //xx console.log(" exploring elements,",element.nodeId.toString());
            const browseDesc1 = {
                nodeId: element.nodeId,
                referenceTypeId: opcua.resolveNodeId("HierarchicalReferences"),
                browseDirection: BrowseDirection.Forward,
                includeSubtypes: true,
                nodeClassMask: 0x1, // Objects
                resultMask: 63
            };

            const nodesToBrowse = [browseDesc1];
            session.browse(nodesToBrowse,function(err,browseResults) {
                if (err) {
                    console.log("err =",err);
                }
                if (!err) {
                    browseResults[0].references.forEach(function(ref) {
                        if (isConditionEventType(ref.typeDefinition)) {
                            //
                            const alarm ={
                                parent:       element.nodeId,
                                browseName: ref.browseName,
                                alarmNodeId : ref.nodeId,
                                typeDefinition: ref.typeDefinition,
                                typeDefinitionName: conditions[ref.typeDefinition.toString()]
                            };
                            found.push(alarm);

                        } else {
                            q.push({nodeId: ref.nodeId});
                        }
                    });
                }
                callback(err);
            });

        });
        q.push({
            nodeId: nodeId
        });
        q.drain = function( ) {
            callback();
        };

    }
    enumerateAllConditionTypes(the_session,function(err,map){
        conditions = map;
        exploreForObjectOfType(the_session,opcua.resolveNodeId("RootFolder"),function(err) {
            if (!err) {
                return callback(null,found);
            }
            return callback(err);
        });
    });

}


const makeNodeId = opcua.makeNodeId;
const ObjectTypeIds = opcua.ObjectTypeIds;

/**
 * @method getAllEventType
 * getAllEventType recursively
 * @param session
 * @param callback
 */
function getAllEventTypes(session,callback)
{
    const baseNodeId = makeNodeId(ObjectTypeIds.BaseEventType);

    const q = new async.queue(function(task,callback) {

        _getAllEventTypes(task.nodeId, task.tree, function (err, result) {
            if(err){return callback(err);}
            callback(null,result);
        });

    });
    function _getAllEventTypes(baseNodeId,tree,callback) {

        //xx console.log(" exploring elements,",element.nodeId.toString());
        const browseDesc1 = {
            nodeId: baseNodeId,
            referenceTypeId: opcua.resolveNodeId("HasSubtype"),
            browseDirection: BrowseDirection.Forward,
            includeSubtypes: true,
            nodeClassMask: opcua.NodeClassMask.ObjectType, // Objects
            resultMask: 63
        };
        session.browse(browseDesc1, function(err,browseResult){
            if (err) {
                console.log(" ERROR = ", err);
            } else {
                // to do continuation points
                browseResult.references.forEach(function (reference) {
                    const subtree = {nodeId: reference.nodeId.toString()};
                    tree[reference.browseName.toString()] = subtree;
                    q.push({nodeId: reference.nodeId, tree: subtree});
                });

            }

            callback();
        });
    }
    const result ={};

    q.push({nodeId: baseNodeId,tree: result});

    q.drain = function( ) {
        callback(null,result);
    };

}
const callConditionRefresh = opcua.callConditionRefresh;

function monitorAlarm(subscription,alarmNodeId, callback) {

    assert(_.isFunction(callback));

    callConditionRefresh(subscription, function(/*err*/) {
        callback();
    });
}

async.series([
    function (callback) {

        const options = {
            endpoint_must_exist: false,
            keepSessionAlive: true,
            connectionStrategy: {
                maxRetry: 10,
                initialDelay: 2000,
                maxDelay: 10*1000
            }
        };

        client = new opcua.OPCUAClient(options);

        console.log(" connecting to ", endpointUrl.cyan.bold);
        console.log("    strategy", client.connectionStrategy);

        client.connect(endpointUrl, callback);

        client.on("backoff", function (number, delay) {
            console.log("backoff  attempt #".bgWhite.yellow,number, " retrying in ",delay/1000.0," seconds");
        });

    },

    function (callback) {


        client.getEndpointsRequest(function (err, endpoints) {

            if (argv.debug) {
                fs.writeFile("tmp/endpoints.log", JSON.stringify(endpoints, null, " "));
                console.log(treeify.asTree(endpoints, true));
            }

            const table = new Table();
            if (!err) {
                endpoints.forEach(function (endpoint, i) {
                    table.cell("endpoint", endpoint.endpointUrl + "");
                    table.cell("Application URI", endpoint.server.applicationUri);
                    table.cell("Product URI", endpoint.server.productUri);
                    table.cell("Application Name", endpoint.server.applicationName.text);
                    table.cell("Security Mode", endpoint.securityMode.toString());
                    table.cell("securityPolicyUri", endpoint.securityPolicyUri);
                    table.cell("Type", endpoint.server.applicationType.key);
                    table.cell("certificate", "..." /*endpoint.serverCertificate*/);
                    endpoint.server.discoveryUrls = endpoint.server.discoveryUrls || [];
                    table.cell("discoveryUrls",endpoint.server.discoveryUrls.join(" - "));

                    serverCertificate = endpoint.serverCertificate;

                    const certificate_filename = path.join(__dirname, "../certificates/PKI/server_certificate" + i + ".pem");

                   if (serverCertificate) {
                       fs.writeFile(certificate_filename, crypto_utils.toPem(serverCertificate, "CERTIFICATE"),function(){});
                   }
                    table.newRow();
                });
                console.log(table.toString());

                endpoints.forEach(function (endpoint) {
                    console.log("Identify Token for : Security Mode=", endpoint.securityMode.toString()," Policy=", endpoint.securityPolicyUri);
                    const table2 = new Table();
                    endpoint.userIdentityTokens.forEach(function (token) {
                        table2.cell("policyId", token.policyId);
                        table2.cell("tokenType", token.tokenType.toString());
                        table2.cell("issuedTokenType", token.issuedTokenType);
                        table2.cell("issuerEndpointUrl", token.issuerEndpointUrl);
                        table2.cell("securityPolicyUri", token.securityPolicyUri);
                        table2.newRow();
                    });
                    console.log(table2.toString());
                });

            }

            callback(err);
        });
    },
    //------------------------------------------
    function (callback) {
        client.disconnect(callback);
    },

    // reconnect using the correct end point URL now
    function (callback) {

        const hexDump = opcua.hexDump;
        console.log("Server Certificate :".cyan);
        console.log(hexDump(serverCertificate).yellow);

        const options = {
            securityMode: securityMode,
            securityPolicy: securityPolicy,
            serverCertificate: serverCertificate,

            defaultSecureTokenLifetime: 40000,

            endpoint_must_exist:false,

            connectionStrategy: {
                maxRetry: 10,
                initialDelay: 2000,
                maxDelay: 10*1000
            }
        };
        console.log("Options = ", options.securityMode.toString(), options.securityPolicy.toString());

        client = new opcua.OPCUAClient(options);

        console.log(" reconnecting to ", endpointUrl.cyan.bold);
        client.connect(endpointUrl, callback);
    },

    //------------------------------------------
    function (callback) {

        let userIdentity = null; // anonymous
        if (argv.userName && argv.password) {

            userIdentity = {
                userName: argv.userName,
                password: argv.password
            };

        }
        client.createSession(userIdentity, function (err, session) {
            if (!err) {
                the_session = session;
                console.log(" session created".yellow);
                console.log(" sessionId : ", session.sessionId.toString());
            }
            callback(err);
        });
    },
    function set_event_handlers(callback) {
        client.on("connection_reestablished",function() {
            console.log(" !!!!!!!!!!!!!!!!!!!!!!!!  CONNECTION RE-ESTABLISHED !!!!!!!!!!!!!!!!!!!".bgWhite.red);
        });
        client.on("backoff", function (number, delay) {
            console.log("backoff  attempt #".bgWhite.yellow,number, " retrying in ",delay/1000.0," seconds");
        });
        client.on("start_reconnection", function () {
            console.log(" !!!!!!!!!!!!!!!!!!!!!!!!  Starting Reconnection !!!!!!!!!!!!!!!!!!!".bgWhite.red);
        });


        callback();
    },
    // ----------------------------------------
    // display namespace array
    function (callback) {

        const server_NamespaceArray_Id = opcua.makeNodeId(VariableIds.Server_NamespaceArray); // ns=0;i=2006

        the_session.readVariableValue(server_NamespaceArray_Id, function (err, dataValue) {

            console.log(" --- NAMESPACE ARRAY ---");
            if (!err) {
                const namespaceArray = dataValue.value.value;
                for (let i = 0; i < namespaceArray.length; i++) {
                    console.log(" Namespace ", i, "  : ", namespaceArray[i]);
                }
            }
            console.log(" -----------------------");
            callback(err);
        });
    },

    function (callback) {

        getAllEventTypes(the_session,function(err,result){

            console.log("--------------------------------------------------------------- All Event Types ".cyan);
            console.log(treeify.asTree(result, true));

            callback();
        });
    },

    //------------------------------------------
    function (callback) {

        let t1,t2;
        function print_stat() {
            t2 = Date.now();
            const util = require("util");
            const str = util.format("R= %d W= %d T=%d t= %d", client.bytesRead, client.bytesWritten, client.transactionsPerformed, (t2 - t1));
            console.log(str.yellow.bold);
        }

        if (doCrawling) {
            assert(_.isObject(the_session));
            const crawler = new NodeCrawler(the_session);

            let t = Date.now();
            client.on("send_request", function () {
                t1 = Date.now();
            });


            //client.on("receive_response", print_stat);

            t = Date.now();
            //xx crawler.on("browsed", function (element) {
            //xx     console.log("->",(new Date()).getTime()-t,element.browseName.name,element.nodeId.toString());
            //xx });

            const nodeId = "ObjectsFolder";
            console.log("now crawling object folder ...please wait...");
            crawler.read(nodeId, function (err, obj) {
                console.log(" Time         = ", (new Date()).getTime() - t);
                console.log(" read        = ", crawler.readCounter);
                console.log(" browse      = ", crawler.browseCounter);
                console.log(" transaction = ", crawler.transactionCounter);
                if (!err) {

                    if (false) {
                        // todo : treeify.asTree performance is *very* slow on large object, replace with better implementation
                        //xx console.log(treeify.asTree(obj, true));
                        treeify.asLines(obj, true, true, function (line) {
                            console.log(line);
                        });
                    } else {
                        process.exit(1);
                    }
                }
                client.removeListener("receive_response", print_stat);
                callback(err);
            });

        } else {
            callback();
        }


    },

    // -----------------------------------------------------------------------------------------------------------------
    // enumerate all Condition Types exposed by the server
    // -----------------------------------------------------------------------------------------------------------------
    function (callback) {

        enumerateAllConditionTypes(the_session,function(err,conditionTypes,conditionTree){
            console.log(treeify.asTree(conditionTree));
            callback();
        });
    },

    // -----------------------------------------------------------------------------------------------------------------
    // enumerate all objects that have an Alarm & Condition instances
    // -----------------------------------------------------------------------------------------------------------------
    function (callback) {

        enumerateAllAlarmAndConditionInstances(the_session,function(err,alarms) {

            if(!err) {

                console.log(" -------------------------------------------------------------------- Alarms & Conditions ------------------------");
                alarms.forEach(function(alarm) {
                    console.log(
                        "parent = ",
                        w(alarm.parent.toString(),30).cyan,
                        w(alarm.typeDefinitionName,30).green.bold,
                        "alarmName = ",
                        w(alarm.browseName.toString(),30).cyan,
                        w(alarm.alarmNodeId.toString(),40).yellow
                    );
                });
                console.log(" -----------------------------------------------------------------------------------------------------------------");

            }
            callback();
        });


    },
    // ------------------ check if server supports Query Services
    function (callback){

        const queryFirstRequest = {};

        the_session.queryFirst(queryFirstRequest,function(err/*,queryFirstResult*/) {
            if (err) {
                console.log("QueryFirst is not supported by Server");
            }
            callback();
        });

    },

    function _resd_historyServerCapabilities(callback) {

        opcua.readHistoryServerCapabilities(the_session,function(err,historyServerCapabilities){
            console.log(historyServerCapabilities);
            callback(null);
        });
    },
    // create Read
    function (callback) {

        if (!doHistory) {
            return callback();
        }
        const now = Date.now();
        const start = now-1000; // read 1 seconds of history
        the_session.readHistoryValue(monitored_node,start,now,function(err,historicalReadResult) {

            if(!err)  {
                console.log(" historicalReadResult =",historicalReadResult.toString());
            } else {
                console.log(" ERROR",err.toString());
            }
            callback();

        });
    },

    // -----------------------------------------
    // create subscription
    function (callback) {

        const parameters = {
            requestedPublishingInterval: 100,
            requestedLifetimeCount: 1000,
            requestedMaxKeepAliveCount: 12,
            maxNotificationsPerPublish: 10,
            publishingEnabled: true,
            priority: 10
        };

        the_subscription = new opcua.ClientSubscription(the_session, parameters);

        function getTick() {
            return Date.now();
        }

        let t = getTick();

        the_subscription.on("started", function () {

            console.log("started subscription :", the_subscription.subscriptionId);

            console.log(" revised parameters ");
            console.log("  revised maxKeepAliveCount  ", the_subscription.maxKeepAliveCount, " ( requested ", parameters.requestedMaxKeepAliveCount + ")");
            console.log("  revised lifetimeCount      ", the_subscription.lifetimeCount, " ( requested ", parameters.requestedLifetimeCount + ")");
            console.log("  revised publishingInterval ", the_subscription.publishingInterval, " ( requested ", parameters.requestedPublishingInterval + ")");
            console.log("  suggested timeout hint     ", the_subscription.publish_engine.timeoutHint);

            callback();

        }).on("internal_error", function (err) {
            console.log(" received internal error", err.message);

        }).on("keepalive", function () {

            const t1 = getTick();
            const span = t1 - t;
            t = t1;
            console.log("keepalive ", span / 1000, "sec", " pending request on server = ", the_subscription.publish_engine.nbPendingPublishRequests);

        }).on("terminated", function (err) {

        });
    },

    function get_monitored_item(callback) {

        the_session.getMonitoredItems(the_subscription.subscriptionId, function (err, results) {
            if (!err) {
                console.log("MonitoredItems clientHandles", results.clientHandles);
                console.log("MonitoredItems serverHandles", results.serverHandles);
            } else {
                console.log(" getMonitoredItems ERROR ".red, err.message.cyan);
            }
            callback();
        });


    },

    function monitor_a_variable_node_value(callback) {
        console.log("Monitoring monitor_a_variable_node_value");

        // ---------------------------------------------------------------
        //  monitor a variable node value
        // ---------------------------------------------------------------
        const monitoredItem = the_subscription.monitor(
            {
                nodeId: monitored_node,
                attributeId: AttributeIds.Value
            },
            {
                samplingInterval: 250,
                //xx filter:  { parameterTypeId: "ns=0;i=0",  encodingMask: 0 },
                queueSize: 10000,
                discardOldest: true
            }
        );
        monitoredItem.on("initialized", function () {
            console.log("monitoredItem initialized");
            callback();
        });
        monitoredItem.on("changed", function (dataValue) {
            console.log(monitoredItem.itemToMonitor.nodeId.toString(), " value has changed to " + dataValue.value.toString());
        });
        monitoredItem.on("err", function (err_message) {
            console.log(monitoredItem.itemToMonitor.nodeId.toString(), " ERROR".red, err_message);
            callback();
        });

    },

    function monitor_the_object_events(callback) {
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


        const eventFilter = opcua.constructEventFilter(fields,[opcua.resolveNodeId("ConditionType")]);

        const event_monitoringItem = the_subscription.monitor(
            {
                nodeId:      serverObjectId,
                attributeId: AttributeIds.EventNotifier
            },
            {
                queueSize: 100000,
                filter: eventFilter,
                discardOldest: true
            }
        );

        event_monitoringItem.on("initialized", function () {
            console.log("event_monitoringItem initialized");
            callback();
        });

        event_monitoringItem.on("changed", function (eventFields) {
            dumpEvent(the_session,fields,eventFields,function() {});
        });
        event_monitoringItem.on("err", function (err_message) {
            console.log("event_monitoringItem ", baseEventTypeId, " ERROR".red, err_message);
        });

    },

    function (callback) {
        console.log("Monitoring alarms");
        const alarmNodeId = "ns=2;s=1:Colours/EastTank?Green";
        monitorAlarm(the_subscription,alarmNodeId,function() {
            callback();
        });
    },


    function (callback) {
        console.log("Starting timer ",timeout);
        if (timeout > 0) {
            setTimeout(function () {
                if (!the_subscription) {
                    return callback();
                }
                the_subscription.terminate(callback);
            }, timeout);

            // simulate a connection break at t =timeout/2
            setTimeout(function () {

                console.log("  -------------------------------------------------------------------- ".red.bgWhite);
                console.log("  --                               SIMULATE CONNECTION BREAK        -- ".red.bgWhite);
                console.log("  -------------------------------------------------------------------- ".red.bgWhite);
                const socket = client._secureChannel._transport._socket;
                socket.end();
                socket.emit("error", new Error("ECONNRESET"));
            }, timeout/2.0);

        }else {
            callback();
        }
    },


    function (callback) {
        console.log(" closing session");
        the_session.close(function (err) {
            console.log(" session closed",err);
            callback();
        });
    },

    function (callback) {
        console.log(" Calling disconnect");
        client.disconnect(callback);
    }
], function (err) {

    console.log(" disconnected".cyan);

    if (err) {
        console.log(" client : process terminated with an error".red.bold);
        console.log(" error", err);
        console.log(" stack trace", err.stack);
    } else {
        console.log("success !!   ");
    }
    // force disconnection
    if (client) {
        client.disconnect(function () {
            const exit = require("exit");
            console.log("Exiting");
            exit();
        });
    }
});

process.on("error",function(err){

    console.log(" UNTRAPPED ERROR",err.message);
});

let user_interruption_count = 0;
process.on("SIGINT", function () {

    console.log(" user interuption ...");

    user_interruption_count += 1;
    if (user_interruption_count >= 3) {
        process.exit(1);
    }
    if (the_subscription) {

        console.log(" Received client interruption from user ".red.bold);
        console.log(" shutting down ...".red.bold);

        the_subscription.terminate(function() {});
        the_subscription = null;
    }
});
