var fs = require("fs");
var treeify = require('treeify');
var _ = require("underscore");
var color = require("colors");
var util = require("util");
var Table = require('easy-table');
var async = require("async");
var utils = require('../lib/utils');


var argv = require('optimist')
    .usage('Usage: $0 -d')
    .argv;

var opcua = require("../");

var client = new opcua.OPCUAClient();

var endpointUrl = argv.endpoint;

if (!endpointUrl) {
    console.log(" node bin/simple_client.js --endpoint <endpointUrl>");
    return;
}
var the_session = null;
var the_subscription= null;


function browseTree(root, nodeId, callback) {

    var nodeIds = _.isArray(nodeId) ? nodeId : [nodeId];

    var folderTypeNodeId = opcua.resolveNodeId("FolderType");

    the_session.browse(nodeIds, function (err, results,diagnostics) {

        var tasks = [];

        if (!err) {
            // we want typeDefinition i=61 => FolderType
            results[0].references.forEach(function (node) {

                root[node.browseName.name] = {};
                root[node.browseName.name].value =(node.isForward ? "->" : "<-") + "id: " + node.nodeId.toString();
                root[node.browseName.name].typeDefinition  =node.typeDefinition.toString();
                root[node.browseName.name].nodes = {};

                if (node.typeDefinition.value === folderTypeNodeId.value   || node.typeDefinition.value === 2000 || node.typeDefinition.value === 62  ) {

                    if (node.isForward) {
                        //xx console.log(" appending : " + node.nodeId.displayText());
                        tasks.push(function(callback){    browseTree(root[node.browseName.name].nodes,node.nodeId,callback);                });
                    }
                }
            });


            process.nextTick(function(){
                async.series(tasks,function() {
                    callback(err,root);
                });
            });

        } else {
            console.log(err);
            callback(err,null);
        }
    });


}


async.series([
    function(callback) {
        console.log(" connecting to ", endpointUrl.cyan.bold);
        client.connect(endpointUrl,callback);
    },

    function(callback) {
        client.getEndPointRequest(function (err,endpoints) {

            endpoints = utils.replaceBufferWithHexDump(endpoints);

            if (argv.d) {
                var f = fs.writeFile("tmp/endpoints.log",JSON.stringify(endpoints,null," "));
                console.log(treeify.asTree(endpoints,true));
            }

            var table= new Table();
            if (!err) {
                endpoints.forEach(function(endpoint){
                    table.cell('endpoint', endpoint.endpointUrl);
                    table.cell('Application URI', endpoint.server.applicationUri);
                    table.cell('Security Mode', endpoint.securityMode);
                    table.cell('securityPolicyUri', endpoint.securityPolicyUri);
                    table.cell('Type', endpoint.server.applicationType.key);
                    table.cell('certificate', "..." /*endpoint.serverCertificate*/);
                    table.newRow();
                });
            }
            console.log(table.toString());

            // store the endpointUrl so we can reopen the connection
            endpointUrl =endpoints[0].endpointUrl;

            callback(err);
        });
    },
    //------------------------------------------
    function(callback) {
        client.disconnect(callback);
    },

    // reconnect using the correct end point URL now
    function(callback) {
        console.log(" reconnecting to ", endpointUrl.cyan.bold);
        client.connect(endpointUrl,callback);
    },

    //------------------------------------------
    function(callback) {
        client.createSession(function (err,session){
            if (!err) {
                the_session = session;
                console.log(" session created".yellow);
            }
            callback(err);
        });
    },

    //------------------------------------------
    function(callback) {
        var root = {};
        browseTree(root,"RootFolder",function(err,root){
            console.log(treeify.asTree(root, true));
            callback(err);
        });

    },
    // -----------------------------------------
    // create subscription
    function(callback) {
        the_subscription=new opcua.ClientSubscription(the_session,{
            requestedPublishingInterval: 100,
            requestedLifetimeCount: 10,
            requestedMaxKeepAliveCount: 2,
            maxNotificationsPerPublish: 10,
            publishingEnabled: false,
            priority: 10
        });
        //xx the_subscription.monitor("i=155",DataType.Value,function onchanged(dataValue){
        //xx    console.log(" temperature has changed " + dataValue.value.value);
        //xx });
        the_subscription.on("started",function(){
            console.log("started",the_subscription);
        }).on("keepalive",function(){
            console.log("keepalive");
        }).on("terminated",function(){
            callback();
        });
        setTimeout(function(){
            the_subscription.terminate();
        },2000);
    },
    function(callback) {
        console.log(" closing session");
        the_session.close(function(err){

            console.log(" session closed");
            callback();
        });
    },

    function(callback) {
        console.log(" Calling disconnect");
        client.disconnect(callback);
    }
],function(err){
    if (err) {
        console.log(" client : process terminated with an error");
        console.log(" error" , err) ;
        console.log(err.stack) ;
    } else {
        console.log("success !!   ");
    }
    // force disconnection
    if (client) {  client.disconnect(function(){}); }
});


