var readline = require('readline');
var fs = require("fs");
var treeify = require('treeify');
var color = require('colors');
var sprintf = require('sprintf');

var opcua = require("..");
var OPCUAClient = opcua.OPCUAClient;

var utils = require('../lib/utils');
var assert = require('better-assert');
var util = require("util");

function completer(line) {

    var completion,hits;
    if (line.trim().indexOf("open")) {

        completions = 'localhost <port>'.split(' ');
        hits = completions.filter(function(c) { return c.indexOf(line) === 0 });
        return [hits.length ? hits : completions, line]
    } else {
        completions = 'open close getEndpoints quit'.split(' ');
        hits = completions.filter(function(c) { return c.indexOf(line) === 0 });
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
        assert(message);
        console.log(" receive response".cyan.bold);
        var analyze_object_binary_encoding = require("../lib/packet_analyzer").analyze_object_binary_encoding;
        analyze_object_binary_encoding(message);
    }
});


function colorize(value) {
    return ("" + value).yellow.bold;
}

if (rl.history) {
    var hostname = require("os").hostname();
    hostname = hostname.toLowerCase();
    rl.history.push("open opc.tcp://" + hostname + ":51210/UA/SampleServer");
    rl.history.push("open opc.tcp://" + hostname + ":4841");
    rl.history.push("open opc.tcp://" + "localhost" + ":51210/UA/SampleServer");
    rl.history.push("open opc.tcp://" + hostname + ":6543/UA/SampleServer");
    rl.history.push("b ObjectsFolder");
    rl.history.push("r ns=2;s=Furnace_1.Temperature");

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

                nodes = [ args[1] ];

                the_sesssion.browse(nodes,function(err,nodeResults) {

                    if (err ) {
                        console.log(err);
                        console.log(nodeResults);
                    } else {

                        for (var i = 0; i < nodeResults.length; i++ ) {
                            console.log("Node: ", nodes[i]);
                            console.log(" StatusCode =", nodeResults[i].statusCode.toString(16));
                            nodeResults[i].references.forEach(function(node){
                                str = sprintf("    %-30s%s%s",node.browseName.name,(node.isForward ? "->" : "<-") ,node.nodeId.displayText()  );
                                console.log(str);
                            });
                        }
                    }
                });
                rl.resume();

            }
            break;

        case 'r':
        case 'read':
            if (the_sesssion) {
                rl.pause();
                nodes = [args[1]];

                the_sesssion.readVariableValue(nodes,function(err,dataValues) {
                    if (err ) {
                        console.log(err);
                        console.log(dataValues);
                    } else {
                        for (var i = 0; i < dataValues.length; i++ ) {
                            var dataValue = dataValues[i];
                            console.log("           Node : ", (nodes[i]).cyan.bold);
                            if (dataValue.value) {
                                 console.log("           type : ",colorize(dataValue.value.dataType.key));
                                 console.log("           value: ",colorize(dataValue.value.value));
                            } else {
                                console.log("           value: <null>");
                            }
                            console.log("      statusCode: 0x", dataValue.statusCode.toString(16) );
                            console.log(" sourceTimestamp: ",dataValue.sourceTimestamp, dataValue.sourcePicoseconds );
                        }
                    }
                });
                rl.resume();
            }
            break;
        case 'ra':
        case 'readall':
            if (the_sesssion) {
                rl.pause();
                nodes = [args[1]];

                the_sesssion.readAllAttributes(nodes,function(err,nodesToRead,dataValues,diagnosticInfos) {
                    if (!err) {
                        for (var i = 0; i < dataValues.length; i++ ) {
                            console.log("           Node : ", util.inspect(nodesToRead[i],{colors:true}));
                            var dataValue = dataValues[i];
                            if (dataValue.value) {
                                console.log("           type : ",colorize(dataValue.value.dataType.key));
                                console.log("           value: ",colorize(dataValue.value.value));
                            } else {
                                console.log("           value: <null>");
                            }
                            console.log("      statusCode: 0x", dataValue.statusCode.toString(16) );
                            console.log(" sourceTimestamp: ",dataValue.sourceTimestamp, dataValue.sourcePicoseconds );
                        }
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



