var readline = require('readline');
var fs = require("fs");
var treeify = require('treeify');
var OPCUAClient = require("../lib/opcua-client.js").OPCUAClient;
var utils = require('../lib/utils');
var opcua = require('../lib/nodeopcua');
var color = require('colors');
var ec = require("../lib/encode_decode");
var browse_service = require("../lib/browse_service");

function completer(line) {

    var completion,hits;
    if (line.trim().indexOf("open")) {

        completions = 'localhost <port>'.split(' ');
        hits = completions.filter(function(c) { return c.indexOf(line) == 0 });
        return [hits.length ? hits : completions, line]
    } else {
        completions = 'open close getEndpoints quit'.split(' ');
        hits = completions.filter(function(c) { return c.indexOf(line) == 0 });
        // show all completions if none found
        return [hits.length ? hits : completions, line]
    }
}

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: completer
});

var the_sesssion = null;

var client = new OPCUAClient();

client.on("send_chunk",function(message_chunk){
    console.log(">> " +message_chunk.length);
});

client.on("receive_chunk",function(message_chunk){
    console.log("<< " +message_chunk.length);
});

var dumpPacket = false;

client.on("send_request",function(message){
    if (dumpPacket) {
        console.log(" sending request".red);
        var analyze_object_binary_encoding = require("../lib/packet_analyzer").analyze_object_binary_encoding;
        analyze_object_binary_encoding(message);
    }
});
client.on("receive_response",function(message){
    if (dumpPacket) {
        console.log(" receive response".cyan.bold);
        var analyze_object_binary_encoding = require("../lib/packet_analyzer").analyze_object_binary_encoding;
        analyze_object_binary_encoding(message);
    }
});


var variables = require("./../lib/opcua_node_ids").Variable;

function get_variable_nodeid(value1,value2) {
    if(variables.hasOwnProperty(value1)) {
        nodeId = get_variable_nodeid(variables[value1],0);
        console.log("node 0 ",nodeId);
    } else if (parseInt(value1).toString() === value1 ) {
        nodeId= ec.makeNodeId(parseInt(value1),parseInt(value2));
        console.log("node 1 ",parseInt(value1),nodeId);
    } else {
        nodeId = ec.makeNodeId(value1,parseInt(value2));
        console.log("node 2 ",nodeId);

    }

    return nodeId;
}


if (rl.history) {
    var hostname = require("os").hostname();
    rl.history.push("open opc.tcp://" + hostname + ":51210/UA/SampleServer");
}

rl.prompt(">");
rl.on('line', function (line) {

    var args = line.trim().split(" ");
    var cmd = args[0];

    switch(cmd) {
        case 'debug':
            process.env.DEBUG = "ALL";
            console.log(" Debug is ON");
            dumpPacket = true;
            break;
        case 'open':

            var endpoint_url = args[1];
            var p = opcua.parseEndpointUrl(endpoint_url);
            var hostname = p.hostname;
            var port = p.port;
            console.log(" open hostname " + hostname + " port : " + port);
            rl.pause();
            client.connect(endpoint_url,function(err){
                console.log("client connected err=",err);
                rl.resume();
                rl.prompt();
            });
            break;
        case 'close':
            if (the_sesssion) {
                the_sesssion.close(function(){
                    the_sesssion = null;
                    client.disconnect(function(){
                        rl.write("client disconnected");
                    });

                });
            } else {
                client.disconnect(function(){
                    rl.write("client disconnected");
                });
            }
            break;
        case 'gep':
        case 'getEndpoints':
            rl.pause();
            client.getEndPointRequest(function (err,endpoints){

                endpoints = utils.replaceBufferWithHexDump(endpoints);
                console.log(treeify.asTree(endpoints,true));

                rl.prompt(">");
                rl.resume();
            });
            break;
        case 'createSession':
        case 'cs':
            rl.pause();
            client.createSession(function (err,session){
                if (err) {
                    console.log("Error : ".red, err);
                } else {
                    //xx  console.log("Session  : ", session);
                    the_sesssion = session;
                    console.log("session created");
                }
                rl.resume();
            });
            break;

        case 'b':
        case 'browse':
            if (the_sesssion) {
                rl.pause();
                nodes = [];
                nodes.push( {
                    nodeId: get_variable_nodeid(args[1],args[2]),
                    includeSubtypes: true,
                    browseDirection: browse_service.BrowseDirection.Both
                });
                console.log(" browse ");
                console.log(treeify.asTree(nodes,true) );
                the_sesssion.browse(nodes,function(err,nodes) {

                    if (err ) {
                        console.log(err);
                        console.log(nodes);
                    } else {
                        //xx console.log(nodes.continuationPoint.toString("hex"));
                        //xx console.log(nodes[0].references[0]);
                        var summary = {};
                        nodes[0].references.forEach(function(node){
                            summary[node.browseName.name] =  "id: " + (node.isForward ? "->" : "<-") +  node.nodeId.toString() ;
                        });
                        console.log(treeify.asTree(summary,true));

                    }
                });
                rl.resume();

            }
            break;

        case 'r':
        case 'read':
            if (the_sesssion) {
                rl.pause();
                nodes = [];
                nodes.push( {
                    nodeId: get_variable_nodeid(args[1],args[2]),
                    attributeId: 13,
                    indexRange: null,
                    dataEncoding: { id:0 , name: null}
                });
                console.log(treeify.asTree(nodes,true));

                the_sesssion.read(nodes,function(err,dataValues) {
                    console.log(" done ...");
                    if (err ) {
                        console.log(err);
                        console.log(dataValues);
                    } else {
                        console.log(dataValues[0]);

                    }
                });
                rl.resume();
            }
            break;

        default:
            console.log('Say what? I might have heard `' + cmd.trim() + '`');
            break;
    }
    rl.prompt();
});



