var readline = require('readline');
var fs = require("fs");
var treeify = require('treeify');
var OPCUAClient = require("../lib/opcua-client.js").OPCUAClient;
var utils = require('../lib/utils');
var opcua = require('../lib/nodeopcua');
var color = require('colors');

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

var the_sesssion = {};

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



if (rl.history) {
    rl.history.push("open opc.tcp://localhost:51210/UA/SampleServer");
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
            client.disconnect(function(){
                rl.write("client disconnected");
            });
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

        default:
            console.log('Say what? I might have heard `' + cmd.trim() + '`');
            break;
    }
    rl.prompt();
});



