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
var assert = require("assert");
var opcua = require("../");
var VariableIds = opcua.VariableIds;

//xx ar UserNameIdentityToken = opcua.session_service.UserNameIdentityToken;
//xx var SecurityPolicy = opcua.SecurityPolicy;

console.log("1");
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

    .alias('e', 'endpoint')
    .alias('s', 'securityMode')
    .alias('P', 'securityPolicy')
    .alias("u", 'userName')
    .alias("p", 'password')
    .alias("n", 'node')
    .alias("t", 'timeout')

    .alias("d", "debug")

    .example("simple_client  --endpoint opc.tcp://localhost:49230 -P=Basic256 -s=SIGN")
    .example("simple_client  -e opc.tcp://localhost:49230 -P=Basic256 -s=SIGN -u JoeDoe -p P@338@rd ")
    .example("simple_client  --endpoint opc.tcp://localhost:49230  -n=\"ns=0;i=2258\"")


    .argv;

console.log("==>", argv.securityPolicy);

var securityMode = opcua.MessageSecurityMode.get(argv.securityMode || "NONE");
var securityPolicy = opcua.SecurityPolicy.get(argv.securityPolicy || "None");

//xx argv.securityMode   = argv.securityMode || "SIGNANDENCRYPT";
//xx argv.securityPolicy = argv.securityPolicy || "Basic128Rsa15";
var timeout = parseInt(argv.timeout) * 1000 || 20000;

var monitored_node = argv.node || "ns=1;s=PumpSpeed"; //"ns=1;s=Temperature";

console.log("securityMode   = ".cyan, securityMode.toString());
console.log("securityPolicy = ".cyan, securityPolicy.toString());
console.log("timeout         = ".cyan, timeout ? timeout : " Infinity " )
console.log(" monitoring node id ", monitored_node);
var client = null;

var endpointUrl = argv.endpoint;




if (!endpointUrl) {
    require('optimist').showHelp();
    return;
}
var the_session = null;
var the_subscription = null;

var AttributeIds = opcua.AttributeIds;

var NodeCrawler = opcua.NodeCrawler;
var doCrawling = argv.crawl ? true : false;

var serverCertificate = null;

var path = require("path");
var crypto_utils = require("lib/misc/crypto_utils");

async.series([
    function (callback) {

        client = new opcua.OPCUAClient();

        console.log(" connecting to ", endpointUrl.cyan.bold);
        client.connect(endpointUrl, callback);
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
                    table.cell('Security Mode', endpoint.securityMode);
                    table.cell('securityPolicyUri', endpoint.securityPolicyUri);
                    table.cell('Type', endpoint.server.applicationType.key);
                    table.cell('certificate', "..." /*endpoint.serverCertificate*/);

                    serverCertificate = endpoint.serverCertificate;

                    var certificate_filename = path.join(__dirname, "../certificates/PKI/server_certificate" + i + ".pem");
                    fs.writeFile(certificate_filename, crypto_utils.toPem(serverCertificate, "CERTIFICATE"));

                    table.newRow();
                });
                console.log(table.toString());

                endpoints.forEach(function (endpoint, i) {
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
            defaultSecureTokenLifetime: 10000
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

    //------------------------------------------
    function (callback) {

        if (doCrawling) {
            assert(_.isObject(the_session));
            var crawler = new NodeCrawler(the_session);

            var t = Date.now();
            var t1;
            client.on("send_request", function () {
                t1 = Date.now();
            });
            client.on("receive_response", function () {
                var t2 = Date.now();
                var util = require("util");
                var str = util.format("R= %d W= %d T=%d t= %d", client.bytesRead, client.bytesWritten, client.transactionsPerformed, (t2 - t1));
                console.log(str.yellow.bold);
            });

            t = Date.now();
            crawler.on("browsed", function (element) {
                // console.log("->",element.browseName.name,element.nodeId.toString());
            });

            var nodeId = "ObjectsFolder";
            console.log("now crawling object folder ...please wait...");
            crawler.read(nodeId, function (err, obj) {
                if (!err) {
                    // todo : treeify.asTree performance is *very* slow on large object, replace with better implementation
                    //xx console.log(treeify.asTree(obj, true));
                    treeify.asLines(obj, true, true, function (line) {
                        console.log(line);
                    });
                }
                callback(err);
            });

        } else {
            callback();
        }


    },

    // -----------------------------------------
    // create subscription
    function (callback) {
        the_subscription = new opcua.ClientSubscription(the_session, {
            requestedPublishingInterval: 10,
            requestedLifetimeCount: 1000,
            requestedMaxKeepAliveCount: 12,
            maxNotificationsPerPublish: 10,
            publishingEnabled: true,
            priority: 10
        });

        var timerId;
        if (timeout > 0) {
            timerId = setTimeout(function () {
                the_subscription.terminate();
            }, timeout);
        }

        the_subscription.on("started", function () {

            console.log("started subscription :", the_subscription.subscriptionId);

            the_session.getMonitoredItems(the_subscription.subscriptionId, function (err, results) {
                if (!err) {
                    console.log("MonitoredItems clientHandles", results.clientHandles);
                    console.log("MonitoredItems serverHandles", results.serverHandles);
                } else {
                    console.log(" getMonitoredItems ERROR ".red, err.message.cyan);
                }
            });


        }).on("internal_error", function (err) {
            console.log(" received internal error", err.message);
            clearTimeout(timerId);
            callback(err);


        }).on("keepalive", function () {
            console.log("keepalive");
        }).on("terminated", function () {
            callback();
        });

        // ---------------------------------------------------------------
        //  monitor a variable node value
        // ---------------------------------------------------------------
        var monitoredItem = the_subscription.monitor(
            {
                nodeId: monitored_node,
                attributeId: AttributeIds.Value
            },
            {
                clientHandle: 13,
                samplingInterval: 500,
                //xx filter:  { parameterTypeId: 'ns=0;i=0',  encodingMask: 0 },
                queueSize: 1,
                discardOldest: true
            }
        );
        monitoredItem.on("initialized", function () {
            console.log("monitoredItem initialized");
        });
        monitoredItem.on("changed", function (dataValue) {
            console.log(monitoredItem.itemToMonitor.nodeId.toString(), " value has changed to " + dataValue.value.value);
        });
        monitoredItem.on("err", function (err_message) {
            console.log(monitoredItem.itemToMonitor.nodeId.toString(), " ERROR".red, err_message);
        });

        // ---------------------------------------------------------------
        //  monitor the object events
        // ---------------------------------------------------------------

        var baseEventTypeId = "i=2041"; // BaseEventType;
        var serverObjectId = "i=2253";
        var event_monitoringItem = the_subscription.monitor(
            {
                nodeId: serverObjectId,
                attributeId: AttributeIds.EventNotifier
            },
            {
                queueSize: 1,
                filter: new opcua.subscription_service.EventFilter({

                    selectClauses: [// SimpleAttributeOperand
                        {
                            typeId: baseEventTypeId, // NodeId of a TypeDefinitionNode.
                            browsePath: [{name: "EventId"}],
                            attributeId: AttributeIds.Value
                        }
                    ],
                    whereClause: { //ContentFilter
                    }
                }),

                discardOldest: true
            }
        );

        event_monitoringItem.on("initialized", function () {
            console.log("event_monitoringItem initialized");
        });

        event_monitoringItem.on("changed", function (value) {
            console.log(event_monitoringItem.itemToMonitor.nodeId.toString(), " value has changed to " + value.toString());
        });
        event_monitoringItem.on("err", function (err_message) {
            console.log("event_monitoringItem ", baseEventTypeId, " ERROR".red, err_message);
        });

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


process.on('SIGINT', function () {
    if (the_subscription) {

        console.log(" Received client interruption from user ".red.bold);
        console.log(" shutting down ...".red.bold);

        the_subscription.terminate();
        the_subscription = null;
    }
});