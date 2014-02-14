var fs = require("fs");
var treeify = require('treeify');
var utils = require('../lib/utils');
var coerceNodeId = require("../lib/nodeid").coerceNodeId;

var util = require("util");
var Table = require('easy-table');
var argv = require('optimist')
    .usage('Usage: $0 --port [num] --hostname <hostname>  -d')
    .argv;

var OPCUAClient = require("../lib/opcua-client.js").OPCUAClient;
var async = require("async");

var client = new OPCUAClient();

var port = argv.port  || 4841
var hostname = argv.hostname || "localhost";

var endpointUrl = "opc.tcp://" + hostname + ":" + port + "/SomeAddress";

var the_session = null;

var browse_service = require("../lib/browse_service");
var color = require("colors");



function browseTree(root, nodeId, callback) {


    var nodeIds = _.isArray(nodeId) ? nodeId : [ nodeId];


    var nodesToBrowse = [];
    nodeIds.map(function(nodeId) {
        return {
            nodeId: nodeId,
            includeSubtypes: true,
            browseDirection: browse_service.BrowseDirection.Forward
        };
    });


    var folderTypeNodeId = coerceNodeId("i=61");
    the_session.browse(nodesToBrowse, function (err, nodes) {


        var tasks = [];
        var nodeIds = [];
        if (!err) {
            // we want typeDefinition i=61 => FolderType
            nodes[0].references.forEach(function (node) {

                root[node.browseName.name] = {};
                root[node.browseName.name].value =(node.isForward ? "->" : "<-") + "id: " + node.nodeId.toString();
                root[node.browseName.name].typeDefinition  =node.typeDefinition.toString();
                root[node.browseName.name].nodes = {};

                if (node.typeDefinition.value != 0 ) { // folderTypeNodeId.value   || node.typeDefinition.value == 2000 || node.typeDefinition.value == 62  ) {
                    nodeIds.push(node.nodeId);
                }
            });
        } else {
            console.log(err.message.red);
        }
        tasks.push(function(callback){
            browseTree(root[node.browseName.name].nodes,nodeIds,callback);
        });

        process.nextTick(function(){
            async.series(tasks,function(){
                callback(err,root);
           });
        });
        // xxcallback(err,root);
    });


}


async.series([
    function(callback) {
        console.log(" connecting to ", endpointUrl);
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
        console.log(" connecting to ", endpointUrl);
        client.connect(endpointUrl,callback);
    },

    //------------------------------------------
    function(callback) {
        client.createSession(function (err,session){
            the_session = session;
            callback(err);
        });
    },

    //------------------------------------------
    function(callback) {
    return callback();
        var root = {};
        browseTree(root,coerceNodeId("i=84"),function(err,root){
            console.log(treeify.asTree(root, true));
            callback(err);
        });

    },
    function(callback) {
        the_session.close(callback);
    },

    function(callback) {
        console.log(" Calling disconnect");
        client.disconnect(callback);
    }
],function(err){
    if (err) {
        console.log(" process terminated with an error");
        console.log(" error" , err) ;
    } else {
        console.log("success !!   ");
    }
});


