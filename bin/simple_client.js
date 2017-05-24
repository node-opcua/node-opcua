"use strict";
require("requirish")._(module);
var fs = require("fs");
var treeify = require('treeify');
var _ = require("underscore");
var colors = require("colors");
var util = require("util");
var Table = require('easy-table');
var async = require("async");
var utils = require('lib/misc/utils');
var assert = require("better-assert");
var opcua = require("../");
var VariableIds = opcua.VariableIds;

//xx ar UserNameIdentityToken = opcua.session_service.UserNameIdentityToken;
//xx var SecurityPolicy = opcua.SecurityPolicy;

//node bin/simple_client.js --endpoint  opc.tcp://localhost:53530/OPCUA/SimulationServer --node "ns=5;s=Sinusoid1"
var argv = require('yargs')
    .wrap(132)
    //.usage('Usage: $0 -d --endpoint <endpointUrl> [--securityMode (NONE|SIGNANDENCRYPT|SIGN)] [--securityPolicy (None|Basic256|Basic128Rsa15)] --node <node_id_to_monitor> --crawl')

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

    .alias('e', 'endpoint')
    .alias('s', 'securityMode')
    .alias('P', 'securityPolicy')
    .alias("u", 'userName')
    .alias("p", 'password')
    .alias("n", 'node')
    .alias("t", 'timeout')

    .alias("d", "debug")
    .alias("h", "history")
    .example("simple_client  --endpoint opc.tcp://localhost:49230 -P=Basic256 -s=SIGN")
    .example("simple_client  -e opc.tcp://localhost:49230 -P=Basic256 -s=SIGN -u JoeDoe -p P@338@rd ")
    .example("simple_client  --endpoint opc.tcp://localhost:49230  -n=\"ns=0;i=2258\"")

    .argv;


var securityMode = opcua.MessageSecurityMode.get(argv.securityMode || "NONE");
if (!securityMode) {
    throw new Error("Invalid Security mode , should be " + opcua.MessageSecurityMode.enums.join(" "));
}

var securityPolicy = opcua.SecurityPolicy.get(argv.securityPolicy || "None");
if (!securityPolicy) {
    throw new Error("Invalid securityPolicy , should be " + opcua.SecurityPolicy.enums.join(" "));
}

//xx argv.securityMode   = argv.securityMode || "SIGNANDENCRYPT";
//xx argv.securityPolicy = argv.securityPolicy || "Basic128Rsa15";
var timeout = parseInt(argv.timeout) * 1000 || 20000;

var monitored_node = argv.node || "ns=1;s=PumpSpeed"; //"ns=1;s=Temperature";

console.log("securityMode        = ".cyan, securityMode.toString());
console.log("securityPolicy      = ".cyan, securityPolicy.toString());
console.log("timeout             = ".cyan, timeout ? timeout : " Infinity " );
console.log(" monitoring node id = ", monitored_node);
var client = null;

var endpointUrl = argv.endpoint;


if (!endpointUrl) {
    require('yargs').showHelp();
    return;
}
var the_session = null;
var the_subscription = null;

var AttributeIds = opcua.AttributeIds;
var DataType = opcua.DataType;

var NodeCrawler = opcua.NodeCrawler;
var doCrawling = argv.crawl ? true : false;
var doHistory = argv.history ? true : false;

var serverCertificate = null;

var path = require("path");
var crypto_utils = require("lib/misc/crypto_utils");


function getBrowseName(session,nodeId,callback) {
    session.read([{ nodeId: nodeId, attributeId: AttributeIds.BrowseName}],function(err,org,readValue) {
        if (!err) {
            if (readValue[0].statusCode === opcua.StatusCodes.Good) {
                assert(readValue[0].statusCode === opcua.StatusCodes.Good);
                var browseName = readValue[0].value.value.name;
                return callback(null,browseName);
            }
        }
        callback(err,"<??>");
    })
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
            })
        }
    },_callback);
}

var q = new async.queue(function(task,callback){
    __dumpEvent(task.session,task.fields,task.eventFields,callback);
});

function dumpEvent(session,fields,eventFields,_callback) {

    q.push({
        session: session, fields:fields, eventFields: eventFields, _callback: _callback
    });

}

function enumerateAllConditionTypes(the_session,callback) {

    var tree = {};

    var conditionEventTypes = {};

    function findAllNodeOfType(tree,typeNodeId,browseName,callback) {

        var browseDesc1 = {
            nodeId: typeNodeId,
            referenceTypeId: opcua.resolveNodeId("HasSubtype"),
            browseDirection: opcua.browse_service.BrowseDirection.Forward,
            includeSubtypes: true,
            resultMask: 63

        };
        var browseDesc2 = {
            nodeId: typeNodeId,
            referenceTypeId: opcua.resolveNodeId("HasTypeDefinition"),
            browseDirection: opcua.browse_service.BrowseDirection.Inverse,
            includeSubtypes: true,
            resultMask: 63

        };
        var browseDesc3 = {
            nodeId: typeNodeId,
            referenceTypeId: opcua.resolveNodeId("HasTypeDefinition"),
            browseDirection: opcua.browse_service.BrowseDirection.Forward,
            includeSubtypes: true,
            resultMask: 63

        };

        var nodesToBrowse = [
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

    var  typeNodeId = opcua.resolveNodeId("ConditionType");
    findAllNodeOfType(tree,typeNodeId,"ConditionType",function(err){
        if (!err) {
            return callback(null,conditionEventTypes,tree);
        }
        callback(err);
    });
}


function enumerateAllAlarmAndConditionInstances(the_session,callback) {

    var conditions = {};

    var found = [];

    function isConditionEventType(nodeId) {
        return conditions.hasOwnProperty(nodeId.toString());
        //x return derivedType.indexOf(nodeId.toString()) >=0;
    }

    function exploreForObjectOfType(session,nodeId,callback) {


        var q = async.queue(function worker(element,callback){

            //xx console.log(" exploring elements,",element.nodeId.toString());
            var browseDesc1 = {
                nodeId: element.nodeId,
                referenceTypeId: opcua.resolveNodeId("HierarchicalReferences"),
                browseDirection: opcua.browse_service.BrowseDirection.Forward,
                includeSubtypes: true,
                nodeClassMask: 0x1, // Objects
                resultMask: 63
            };

            var nodesToBrowse = [browseDesc1];
            session.browse(nodesToBrowse,function(err,browseResults) {
                if (err) {
                    console.log("err =",err);
                }
                if (!err) {
                    browseResults[0].references.forEach(function(ref) {
                        if (isConditionEventType(ref.typeDefinition)) {
                            //
                            var alarm ={
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
        })
    });

}


var makeNodeId = opcua.makeNodeId;
var ObjectTypeIds = opcua.ObjectTypeIds;

/**
 * getAllEventType recursively
 * @param callback
 */
function getAllEventTypes(session,callback)
{
    var baseNodeId = makeNodeId(ObjectTypeIds.BaseEventType);

    var q = new async.queue(function(task,callback) {

        _getAllEventTypes(task.nodeId, task.tree, function (err, result) {
            if(err){return callback(err);}
            callback(null,result);
        });

    });
    function _getAllEventTypes(baseNodeId,tree,callback) {

        //xx console.log(" exploring elements,",element.nodeId.toString());
        var browseDesc1 = {
            nodeId: baseNodeId,
            referenceTypeId: opcua.resolveNodeId("HasSubtype"),
            browseDirection: opcua.browse_service.BrowseDirection.Forward,
            includeSubtypes: true,
            nodeClassMask: opcua.browse_service.NodeClassMask.ObjectType, // Objects
            resultMask: 63
        };

        var nodesToBrowse = [browseDesc1];
        session.browse(nodesToBrowse,function(err,results){
            if (err) {
                console.log(" ERROR = ", err);
            } else {
                // to do continuation points
                results[0].references.forEach(function (reference) {
                    var subtree = {nodeId: reference.nodeId.toString()};
                    tree[reference.browseName.toString()] = subtree;
                    q.push({nodeId: reference.nodeId, tree: subtree});
                });

            }

            callback();
        });
    }
    var result ={};

    q.push({nodeId: baseNodeId,tree: result});

    q.drain = function( ) {
        callback(null,result);
    };

}
var callConditionRefresh = require("lib/client/alarms_and_conditions/client_tools").callConditionRefresh;

function monitorAlarm(subscription,alarmNodeId, callback) {

    assert(_.isFunction(callback));

    callConditionRefresh(subscription, function(err) {
        callback();
    });
}

async.series([
    function (callback) {

        var options = {
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

            var table = new Table();
            if (!err) {
                endpoints.forEach(function (endpoint, i) {
                    table.cell('endpoint', endpoint.endpointUrl + "");
                    table.cell('Application URI', endpoint.server.applicationUri);
                    table.cell('Product URI', endpoint.server.productUri);
                    table.cell('Application Name', endpoint.server.applicationName.text);
                    table.cell('Security Mode', endpoint.securityMode.toString());
                    table.cell('securityPolicyUri', endpoint.securityPolicyUri);
                    table.cell('Type', endpoint.server.applicationType.key);
                    table.cell('certificate', "..." /*endpoint.serverCertificate*/);
                    table.cell('discoveryUrls',endpoint.server.discoveryUrls.join(" - "));

                    serverCertificate = endpoint.serverCertificate;

                    var certificate_filename = path.join(__dirname, "../certificates/PKI/server_certificate" + i + ".pem");
                    fs.writeFile(certificate_filename, crypto_utils.toPem(serverCertificate, "CERTIFICATE"));

                    table.newRow();
                });
                console.log(table.toString());

                endpoints.forEach(function (endpoint, i) {
                    console.log('Identify Token for : Security Mode=', endpoint.securityMode.toString(),' Policy=', endpoint.securityPolicyUri);
                    var table2 = new Table();
                    endpoint.userIdentityTokens.forEach(function (token) {
                        table2.cell('policyId', token.policyId);
                        table2.cell('tokenType', token.tokenType.toString());
                        table2.cell('issuedTokenType', token.issuedTokenType);
                        table2.cell('issuerEndpointUrl', token.issuerEndpointUrl);
                        table2.cell('securityPolicyUri', token.securityPolicyUri);
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

        var hexDump = require("lib/misc/utils").hexDump;
        console.log("Server Certificate :".cyan);
        console.log(hexDump(serverCertificate).yellow);

        var options = {
            securityMode: securityMode,
            securityPolicy: securityPolicy,
            serverCertificate: serverCertificate,

            defaultSecureTokenLifetime: 40000,

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

        var userIdentity = null; // anonymous
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

        var server_NamespaceArray_Id = opcua.makeNodeId(VariableIds.Server_NamespaceArray); // ns=0;i=2006

        the_session.readVariableValue(server_NamespaceArray_Id, function (err, dataValue, diagnosticsInfo) {

            console.log(" --- NAMESPACE ARRAY ---");
            if (!err) {
                var namespaceArray = dataValue.value.value;
                for (var i = 0; i < namespaceArray.length; i++) {
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

        function print_stat() {
            var t2 = Date.now();
            var util = require("util");
            var str = util.format("R= %d W= %d T=%d t= %d", client.bytesRead, client.bytesWritten, client.transactionsPerformed, (t2 - t1));
            console.log(str.yellow.bold);
        }

        if (doCrawling) {
            assert(_.isObject(the_session));
            var crawler = new NodeCrawler(the_session);

            var t = Date.now();
            var t1;
            client.on("send_request", function () {
                t1 = Date.now();
            });


            //client.on("receive_response", print_stat);

            t = Date.now();
            //xx crawler.on("browsed", function (element) {
            //xx     console.log("->",(new Date()).getTime()-t,element.browseName.name,element.nodeId.toString());
            //xx });

            var nodeId = "ObjectsFolder";
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

        return callback();

        var queryFirstRequest = {
        };

        the_session.queryFirst(queryFirstRequest,function(err,queryFirstResult) {
            if (err) {
                console.log("QueryFirst is not supported by Server")
            }
            callback();
        });

    },


    // create Read
    function (callback) {

        if (!doHistory) {
            return callback();
        }
        var now = Date.now();
        var start = now-1000; // read 1 seconds of history
        var end   = now;
        the_session.readHistoryValue(monitored_node,start,end,function(err,historicalReadResult) {

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

        var parameters = {
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

        var t = getTick();

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

            var t1 = getTick();
            var span = t1 - t;
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
        var monitoredItem = the_subscription.monitor(
            {
                nodeId: monitored_node,
                attributeId: AttributeIds.Value
            },
            {
                samplingInterval: 250,
                //xx filter:  { parameterTypeId: 'ns=0;i=0',  encodingMask: 0 },
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

        var baseEventTypeId = "i=2041"; // BaseEventType;
        var serverObjectId = "i=2253";

        var fields = [
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
        var eventFilter = opcua.constructEventFilter(fields);

        var event_monitoringItem = the_subscription.monitor(
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
        var alarmNodeId = "ns=2;s=1:Colours/EastTank?Green";
        monitorAlarm(the_subscription,alarmNodeId,function() {
            callback();
        });
    },


    function (callback) {
        console.log("Starting timer ",timeout);
        var timerId;
        if (timeout > 0) {
            timerId = setTimeout(function () {
                if (!the_subscription) {
                    return callback();
                }
                the_subscription.once("terminated",function() {
                    callback();
                });
                the_subscription.terminate();
            }, timeout);

            // simulate a connection break at t =timeout/2
            setTimeout(function () {

                console.log("  -------------------------------------------------------------------- ".red.bgWhite);
                console.log("  --                               SIMULATE CONNECTION BREAK        -- ".red.bgWhite);
                console.log("  -------------------------------------------------------------------- ".red.bgWhite);
                var socket = client._secureChannel._transport._socket;
                socket.end();
                socket.emit('error', new Error('ECONNRESET'));
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
            var exit = require("exit");
            console.log("Exiting");
            exit();
        });
    }
});

process.on("error",function(err){

    console.log(" UNTRAPPED ERROR",err.message);
});
var user_interruption_count = 0;
process.on('SIGINT', function () {

    console.log(" user interuption ...");

    user_interruption_count += 1;
    if (user_interruption_count >= 3) {
        process.exit(1);
    }
    if (the_subscription) {

        console.log(" Received client interruption from user ".red.bold);
        console.log(" shutting down ...".red.bold);

        the_subscription.terminate();
        the_subscription = null;
    }
});
