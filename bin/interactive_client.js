var readline = require('readline');
var fs = require("fs");
var treeify = require('treeify');
var OPCUAClient = require("../lib/opcua-client.js").OPCUAClient;
var utils = require('../lib/utils');
var color = require('colors');

function completer(line) {

    if (line.trim().indexOf("open")) {

        var completions = 'localhost <port>'.split(' ');
        var hits = completions.filter(function(c) { return c.indexOf(line) == 0 });
        return [hits.length ? hits : completions, line]
    } else {
        var completions = 'open close getEndpoints quit'.split(' ');
        var hits = completions.filter(function(c) { return c.indexOf(line) == 0 });
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

rl.prompt(">");
rl.on('line', function (line) {

    var args = line.trim().split(" ");
    var cmd = args[0];

    switch(cmd) {
        case 'open':
            var hostname = args[1];
            var port = args[2] ;
            if ( !port ) {
                hostname = "localhost";
                port = args[1];
            }
            console.log(" open hostname " + hostname + " port : " + port);
            rl.pause();
            client.connect(hostname,port,function(err){
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

                rl.prompt("client connected");
                rl.resume();
            });
            break;
        case 'createSession':
        case 'cs':
            rl.pause();
            client.createSession(function (err,session){
                if (err) {
                    console.log("Error : ", err);
                } else {
                    console.log("Session  : ", session);
                    the_sesssion = session;
                    rl.prompt("session created");
                    rl.resume();
                }
            });
            break;

        default:
            console.log('Say what? I might have heard `' + cmd.trim() + '`');
            break;
    }
    rl.prompt();
});



