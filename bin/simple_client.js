var fs = require("fs");
var treeify = require('treeify');
var _ = require("underscore");
var color = require("colors");
var util = require("util");
var Table = require('easy-table');
var async = require("async");
var utils = require('../lib/misc/utils');

//node bin/simple_client.js --endpoint  opc.tcp://localhost:53530/OPCUA/SimulationServer --node "ns=5;s=Sinusoid1"
var argv = require('optimist')
    .usage('Usage: $0 -d --endpoint <endpointUrl> --node <node_id_to_monitor> --crawl')
    .argv;

var opcua = require("../");
var VariableIds = opcua.VariableIds;

var client = new opcua.OPCUAClient();

var endpointUrl = argv.endpoint;

var monitored_node = argv.node || "ns=2;s=PumpSpeed"; //"ns=1;s=Temperature";

console.log(" monitoring node id ", monitored_node);

if (!endpointUrl) {
    console.log(" node bin/simple_client.js --endpoint <endpointUrl> --node <node_id_to_monitor>");
    return;
}
var the_session = null;
var the_subscription = null;

var AttributeIds = opcua.AttributeIds;


var NodeCrawler = opcua.NodeCrawler;
var doCrawling = argv.crawl ? true: false;

async.series([
    function (callback) {
        console.log(" connecting to ", endpointUrl.cyan.bold);
        client.connect(endpointUrl, callback);
    },

    function (callback) {
        client.getEndpointsRequest(function (err, endpoints) {

            endpoints = utils.replaceBufferWithHexDump(endpoints);

            if (argv.d) {
                var f = fs.writeFile("tmp/endpoints.log", JSON.stringify(endpoints, null, " "));
                console.log(treeify.asTree(endpoints, true));
            }

            var table = new Table();
            if (!err) {
                endpoints.forEach(function (endpoint) {
                    table.cell('endpoint',           endpoint.endpointUrl);
                    table.cell('Application URI',    endpoint.server.applicationUri);
                    table.cell('Security Mode',      endpoint.securityMode);
                    table.cell('securityPolicyUri',  endpoint.securityPolicyUri);
                    table.cell('Type',               endpoint.server.applicationType.key);
                    table.cell('certificate', "..." /*endpoint.serverCertificate*/);
                    table.newRow();
                });
            }
            console.log(table.toString());


            callback(err);
        });
    },
    //------------------------------------------
    function (callback) {
        client.disconnect(callback);
    },

    // reconnect using the correct end point URL now
    function (callback) {
        console.log(" reconnecting to ", endpointUrl.cyan.bold);
        client.connect(endpointUrl, callback);
    },

    //------------------------------------------
    function (callback) {
        client.createSession(function (err, session) {
            if (!err) {
                the_session = session;
                console.log(" session created".yellow);
            }
            callback(err);
        });
    },

    // ----------------------------------------
    // display namespace array
    function (callback) {

        var server_NamespaceArray_Id = opcua.makeNodeId(VariableIds.Server_NamespaceArray); // ns=0;i=2006

        the_session.readVariableValue(server_NamespaceArray_Id, function (err, results, diagnosticsInfo) {
            var dataValue = results[0];

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

        if(doCrawling) {
            assert(_.isObject(the_session));
            var crawler = new NodeCrawler(the_session);

            var t = Date.now();
            var t1;
            client.on("send_request",function(){
                t1 = Date.now();
            });
            client.on("receive_response",function(){
                var t2 = Date.now();
                var util = require("util");
                var str =  util.format("R= %d W= %d T=%d t= %d", client.bytesRead,client.bytesWritten,client.transactionsPerformed ,(t2-t1));
                console.log(str.yellow.bold);
            });

            var t = Date.now();
            crawler.on("browsed",function(element){
                console.log("->",element.browseName.name,element.nodeId.toString());
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

        var timerId = setTimeout(function () {
            the_subscription.terminate();
        }, 20000);

        the_subscription.on("started", function () {

            console.log("started subscription :", the_subscription.subscriptionId);

            the_session.getMonitoredItems(the_subscription.subscriptionId,function(err,results){
                if( !err) {
                    console.log("MonitoredItems clientHandles" , results.clientHandles);
                    console.log("MonitoredItems serverHandles" , results.serverHandles);
                } else {
                    console.log(" getMonitoredItems ERROR ".red,err.message.cyan);
                }
            });


        }).on("internal_error", function (err) {
            console.log(" received internal error",err.message);
            clearTimeout(timerId);
            callback(err);


        }).on("keepalive", function () {
            console.log("keepalive");
        }).on("terminated", function () {
            callback();
        });
        var monitoredItem = the_subscription.monitor(
            {   nodeId: monitored_node, attributeId: 13    },
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
            console.log(monitored_node, " value has changed to " + dataValue.value.value);
        });


    },
    function (callback) {
        console.log(" closing session");
        the_session.close(function (err) {

            console.log(" session closed");
            callback();
        });
    },

    function (callback) {
        console.log(" Calling disconnect");
        client.disconnect(callback);
    }
], function (err) {

    if (err) {
        console.log(" client : process terminated with an error".red.bold);
        console.log(" error", err);
    } else {
        console.log("success !!   ");
    }
    // force disconnection
    if (client) {
        client.disconnect(function () {
            process.exit()
        });
    }
});


