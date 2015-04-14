var readline = require('readline');
var treeify = require('treeify');
require('colors');
var sprintf = require('sprintf');

var opcua = require("..");
var OPCUAClient = opcua.OPCUAClient;

var utils = require('../lib/misc/utils');
var assert = require('better-assert');
var util = require("util");
var fs = require("fs");
var path = require("path");
var _ = require("underscore");

console.log(" Version ", opcua.version);

var client = new OPCUAClient();
var the_session = null;
var crawler = null;

var dumpPacket = false;
var dumpMessageChunk = false;


var sessionTimeout = 5000;


var endpoints_history = [];

function add_endpoint_to_history(endpoint) {
    if (endpoints_history.indexOf(endpoint)>=0) return; // already in
    endpoints_history.push(endpoint);
    save_endpoint_history();
}

var endpoints_history_file = path.join(__dirname,".history_endpoints");

function save_endpoint_history(callback) {
    if (endpoints_history.length>0) {
        fs.writeFileSync(endpoints_history_file,endpoints_history.join("\n"),"ascii");
    }
    if (callback) { callback();}
}

if (fs.existsSync(endpoints_history_file)) {
    lines = fs.readFileSync(endpoints_history_file,"ascii");
    endpoints_history = lines.split(/\r\n|\n/);
}

var history_file =path.join(__dirname,".history");

function save_history(callback) {
    var history_uniq = _.uniq(rl.history);
    fs.writeFileSync(history_file,history_uniq.join("\n"),"ascii");
    callback();
}

function completer(line) {

    var completions, hits;

    if ( "open".match(new RegExp("^"+line.trim()))) {
        completions = [ "open localhost:port" ];
        return [ completions , line];

    } else {
        if (the_session===null) {
            if (client._secureChannel) {
                completions = 'createSession cs getEndpoints gep quit'.split(' ');
            } else {
                completions = "open quit".split(" ");
            }
        } else {
            completions = 'browse read readall crawl closeSession disconnect quit getEndpoints'.split(' ');
        }
    }
    assert(completions.length >= 0);
    hits = completions.filter(function (c) {
        return c.indexOf(line) === 0;
    });
    return [hits.length ? hits : completions, line];
}

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: completer
});

client.on("send_chunk", function (message_chunk) {
    if(dumpMessageChunk) {
        process.stdout.write(">> " + message_chunk.length + "\r");
    }
});

client.on("receive_chunk", function (message_chunk) {
    if(dumpMessageChunk) {
        process.stdout.write("<< " + message_chunk.length + "\r");
    }
});

client.on("send_request", function (message) {
    if (dumpPacket) {
        console.log(" sending request".red);
        var analyze_object_binary_encoding = require("../lib/misc/packet_analyzer").analyze_object_binary_encoding;
        analyze_object_binary_encoding(message);
    }
});
client.on("receive_response", function (message) {
    if (dumpPacket) {
        assert(message);
        console.log(" receive response".cyan.bold);
        var analyze_object_binary_encoding = require("../lib/misc/packet_analyzer").analyze_object_binary_encoding;
        analyze_object_binary_encoding(message);
    }
});


function dumpNodeResult(node) {
  var str = sprintf("    %-30s%s%s", node.browseName.name, (node.isForward ? "->" : "<-"), node.nodeId.displayText());
  console.log(str);
}
function colorize(value) {
    return ("" + value).yellow.bold;
}



if (rl.history) {

    var lines = [];
    if (fs.existsSync(history_file)) {
        lines = fs.readFileSync(history_file,"ascii");
        lines = lines.split(/\r\n|\n/);
    }
    if (lines.length===0 ) {
        var hostname = require("os").hostname();
        hostname = hostname.toLowerCase();
        rl.history.push("open opc.tcp://" + hostname + ":51210/UA/SampleServer");
        rl.history.push("open opc.tcp://" + hostname + ":4841");
        rl.history.push("open opc.tcp://" + "localhost" + ":51210/UA/SampleServer");
        rl.history.push("open opc.tcp://" + hostname + ":6543/UA/SampleServer");
        rl.history.push("open opc.tcp://" + hostname + ":53530/OPCUA/SimulationServer");
        rl.history.push("b ObjectsFolder");
        rl.history.push("r ns=2;s=Furnace_1.Temperature");
    } else {
        rl.history = rl.history.concat(lines);
    }
}

process.on('uncaughtException', function(e) {
    util.puts(e.stack.red);
    rl.prompt();
});

rl.prompt(">");


rl.on('line', function (line) {

    try {
        process_line(line);
    }
    catch (err) {
        console.log("------------------------------------------------".red);
        console.log(err.message.bgRed.yellow.bold);
        console.log(err.stack);
        console.log("------------------------------------------------".red);
        rl.resume();
    }
});

function apply_on_valid_session(cmd,func) {
    if (the_session) {
        func(the_session);
    } else {
        console.log("command : ", cmd.yellow, " requires a valid session , use createSession first");
    }
}

function dump_dataValues(nodesToRead,dataValues) {
    for (var i = 0; i < dataValues.length; i++) {
        var dataValue = dataValues[i];
        console.log("           Node : ", (nodesToRead[i].nodeId.toString()).cyan.bold , nodesToRead[i].attributeId.toString());
        if (dataValue.value) {
            console.log("           type : ", colorize(dataValue.value.dataType.key));
            console.log("           value: ", colorize(dataValue.value.value));
        } else {
            console.log("           value: <null>");
        }
        console.log("      statusCode: 0x", dataValue.statusCode.toString(16));
        console.log(" sourceTimestamp: ", dataValue.sourceTimestamp, dataValue.sourcePicoseconds);
    }

}


/**
 * @method ping_server
 *
 * when a session is opened on a server, the client shall send request on a regular basis otherwise the server
 * session object might time out.
 * start_ping make sure that ping_server is called on a regular basis to prevent session to timeout.
 *
 * @param callback
 */
function ping_server(callback) {

    callback  = callback || function(){};

    var nodes = [opcua.coerceNodeId("ns=0;i=2258")]; // CurrentServer Time
    the_session.readVariableValue(nodes, function (err, dataValues) {
        if(err) {
            console.log(" warning : ".cyan, err.message.yellow);
        }
        callback();
    });
}
var timerId = 0;
function start_ping() {
    timerId = setInterval(ping_server,sessionTimeout / 3);
}
function stop_ping() {
    clearInterval(timerId);
}

function close_session(callback) {
    apply_on_valid_session("closeSession",function(the_session) {
        stop_ping();
        the_session.close(function (err) {
            the_session = null;
            callback();
        });
    });

}

function set_debug(flag) {
    if (flag) {
        dumpPacket = true;
        process.env.DEBUG = "ALL";
        console.log(" Debug is ON");
    } else {
        dumpPacket = true;
        delete process.env.DEBUG;
        console.log(" Debug is OFF");
    }
}

function process_line(line) {
    var nodes;
    var args = line.trim().split(/ +/);
    var cmd = args[0];

    switch (cmd) {
        case 'debug':
            var flag = (!args[1]) ? true: ( ["ON","TRUE","1"].indexOf(args[1].toUpperCase()) >= 0 ? true:false);
            set_debug(flag);
            rl.prompt(">");
            break;
        case 'open':

            var endpoint_url = args[1];
            if (!endpoint_url.match(/^opc.tcp:\/\//)) {
                endpoint_url = "opc.tcp://" + endpoint_url;
            }
            var p = opcua.parseEndpointUrl(endpoint_url);
            var hostname = p.hostname ;
            var port = p.port;
            console.log(" open    url :" , endpoint_url );
            console.log("    hostname :" , (hostname || "<null>").yellow);
            console.log("        port : ", port.yellow);
            rl.pause();
            client.connect(endpoint_url, function (err) {
                if (err) {
                    console.log("client connected err=", err);
                } else {
                    console.log("client connected : ","OK".green);


                    add_endpoint_to_history(endpoint_url);

                    save_history(function(){});


                }
                rl.resume();
                rl.prompt();
            });
            break;

        case 'fs':
        case "FindServers":
            rl.pause();
            client.findServers({

            },function (err, servers) {
                console.log(treeify.asTree(servers, true));
                rl.resume();
                rl.prompt(">");
            });
            break;
        case 'gep':
        case 'getEndpoints':
            rl.pause();
            client.getEndpointsRequest(function (err, endpoints) {

                endpoints = utils.replaceBufferWithHexDump(endpoints);
                console.log(treeify.asTree(endpoints, true));

                rl.resume();
                rl.prompt(">");
            });
            break;
        case 'createSession':
        case 'cs':
            rl.pause();
            client.requestedSessionTimeout = sessionTimeout;
            client.createSession(function (err, session) {
                if (err) {
                    console.log("Error : ".red, err);
                } else {
                    //xx  console.log("Session  : ", session);
                    the_session = session;
                    console.log("session created ",session.sessionId.toString());

                    start_ping();
                }
                rl.resume();
                rl.prompt(">");
            });
            client.on("close",function(){
                console.log(" Server has disconnected ".red);
            })
            break;
        case 'closeSession':
            close_session(function() {
                rl.resume();
                rl.prompt(">");
            });
            break;

        case 'disconnect':
            if (the_session) {
                close_session(function() {
                    client.disconnect(function () {
                        rl.write("client disconnected");
                    });
                });
            } else {
                client.disconnect(function () {
                    rl.write("client disconnected");
                });
            }
            break;
        case 'b':
        case 'browse':
            apply_on_valid_session(cmd,function(the_session){

                rl.pause();

                nodes = [ args[1] ];

                the_session.browse(nodes, function (err, nodeResults) {

                    if (err) {
                        console.log(err);
                        console.log(nodeResults);
                    } else {

                        save_history(function(){});

                        for (var i = 0; i < nodeResults.length; i++) {
                            console.log("Node: ", nodes[i]);
                            console.log(" StatusCode =", nodeResults[i].statusCode.toString(16));
                            nodeResults[i].references.forEach(dumpNodeResult);
                        }
                    }
                    rl.resume();
                    rl.prompt(">");
                });

            });

            break;

        case 'r':
        case 'read':
            apply_on_valid_session(cmd,function(the_session){
                rl.pause();
                nodes = [args[1]];
                nodes = nodes.map(opcua.coerceNodeId);

                the_session.readVariableValue(nodes, function (err, dataValues) {
                    if (err) {
                        console.log(err);
                        console.log(dataValues);
                    } else {
                        save_history(function(){});
                        dump_dataValues([ {
                            nodeId: nodes[0],
                            attributeId: 13
                        }],dataValues);
                    }
                    rl.resume();
                    rl.prompt(">");
                });
            });
            break;
        case 'ra':
        case 'readall':
            apply_on_valid_session(cmd,function(the_session){
                rl.pause();
                nodes = [args[1]];

                the_session.readAllAttributes(nodes, function (err, nodesToRead, dataValues/*,diagnosticInfos*/) {
                    if (!err) {
                        save_history(function(){});
                        dump_dataValues(nodesToRead,dataValues);
                    }
                    rl.resume();
                    rl.prompt(">");
                });
            });
            break;

        case 'tb':
            apply_on_valid_session(cmd,function(the_session){

                var path = args[1];
                rl.pause();
                the_session.translateBrowsePath(path, function (err, results) {
                    console.log(" Path ", path, " is ");
                    console.log(util.inspect(results, {colors: true, depth: 100}));
                    rl.resume();
                    rl.prompt(">");
                });
            });
            break;
        case 'crawl': {
            apply_on_valid_session(cmd,function(the_session){

                if (!crawler) {
                    crawler = new opcua.NodeCrawler(the_session);
                    crawler.on("browsed",function(element){
                        // console.log("->",element.browseName.name,element.nodeId.toString());
                    });

                }

                var  nodeId= args[1]  || "ObjectsFolder";
                console.log("now crawling " + nodeId.yellow + " ...please wait...");
                rl.pause();
                crawler.read(nodeId, function (err, obj) {
                    if (!err) {
                        // todo : treeify.asTree performance is *very* slow on large object, replace with better implementation
                        //xx console.log(treeify.asTree(obj, true));
                        treeify.asLines(obj, true, true, function (line) {
                            console.log(line);
                        });
                    } else {
                        console.log("err ",err.message);
                    }
                    rl.resume();
                    rl.prompt(">");
                });
            });
        } break;
        case "info":

            console.log("            bytesRead  ", client.bytesRead , " bytes");
            console.log("         bytesWritten  ", client.bytesWritten , " bytes");
            console.log("transactionsPerformed  ", client.transactionsPerformed , "");
            // -----------------------------------------------------------------------
            // number of subscriptions
            // -----------------------------------------------------------------------
            // number of monitored items by subscription

            break;
        case ".quit":
            process.exit(0);
        default:
            console.log('Say what? I might have heard `' + cmd.trim() + '`');
            break;
    }
    rl.prompt();
}




