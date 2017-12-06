#!/usr/bin/env node
/* eslint no-process-exit: 0 */
"use strict";

var readline = require("readline");
var treeify = require("treeify");
require("colors");
var sprintf = require("sprintf");
var util = require("util");
var fs = require("fs");
var path = require("path");
var _ = require("underscore");

var opcua = require("node-opcua");
var UAProxyManager = opcua.UAProxyManager;



var utils = opcua.utils;

var assert = require("node-opcua-assert");

console.log(" Version ", opcua.version);

var sessionTimeout = 2 * 60 * 1000; // 2 minutes

var client = new opcua.OPCUAClient({
    requestedSessionTimeout: sessionTimeout,
    keepSessionAlive: true
});

var the_session  = null;
var proxyManager = null;

var crawler           = null;
var dumpPacket        = false;
var dumpMessageChunk  = false;
var endpoints_history = [];

var endpoints_history_file = path.join(__dirname, ".history_endpoints");

var curNode = null;
var curNodeCompletion = [];

function save_endpoint_history(callback) {
    if (endpoints_history.length > 0) {
        fs.writeFileSync(endpoints_history_file, endpoints_history.join("\n"), "ascii");
    }
    if (callback) {
        callback();
    }
}
function add_endpoint_to_history(endpoint) {
    if (endpoints_history.indexOf(endpoint) >= 0) {
        return;
    }
    endpoints_history.push(endpoint);
    save_endpoint_history();
}

var lines = [];



if (fs.existsSync(endpoints_history_file)) {
    lines = fs.readFileSync(endpoints_history_file, "ascii");
    endpoints_history = lines.split(/\r\n|\n/);
}

var history_file = path.join(__dirname, ".history");


function completer(line,callback) {

    var completions, hits;

    if ( (line.trim() === "" ) && curNode) {
        // console.log(" completions ",completions);
        var c = [".."].concat(curNodeCompletion);
        if (curNodeCompletion.length === 1) {
            c = curNodeCompletion;
        }
        return callback(null, [ c, line]);
    }

    if ("open".match(new RegExp("^" + line.trim()))) {
        completions = ["open localhost:port"];
        return callback(null, [ completions, line]);

    } else {
        if (the_session === null) {
            if (client._secureChannel) {
                completions = "createSession cs getEndpoints gep quit".split(" ");
            } else {
                completions = "open quit".split(" ");
            }
        } else {
            completions = "browse read readall crawl closeSession disconnect quit getEndpoints".split(" ");
        }
    }
    assert(completions.length >= 0);
    hits = completions.filter(function (c) {
        return c.indexOf(line) === 0;
    });
    return callback(null,[hits.length ? hits : completions, line]);
}


var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: completer
});

var the_prompt = ">".cyan;
rl.setPrompt(the_prompt);
rl.prompt();

function save_history(callback) {
    var history_uniq = _.uniq(rl.history);
    fs.writeFileSync(history_file, history_uniq.join("\n"), "ascii");
    callback();
}

function w(str,width) {
    return (str + "                                                      ").substr(0,width);
}
/**
 *
 * @param str
 *
 * @example
 *    toDate("now");
 *    toDate("13:00");      => today at 13:00
 *    toDate("1 hour ago"); => today one our ago....
 *
 * @returns {Date}
 */
function toDate(str) {
    console.log(" parsing : '" + str + "'");
    var now = new Date();
    if (!str) {
        return now;
    }
    if (str.toLowerCase() === "now") {
        return now;
    }

    // check if provided date is  <HH>:<MM>

    var t = /([0-9]{1,2}):([0-9]{1,2})/;
    var tt = str.match(t);
    if (tt) {
        // HH:MM of current date
        var year = now.getFullYear();
        var month = now.getMonth(); // 0  : jan , 1: feb etc ...
        var day  = now.getDate();
        var hours = parseInt(tt[1]);
        var minutes = parseInt(tt[2]);
        var seconds = 0;
        var date = new Date(year,month,day,hours,minutes,seconds);
        return date;
    }
    // check if provided date looks like "3 hours ago" | "1 day ago" etc...
    var r = /([0-9]*)(day|days|d|hours|hour|h|minutes|minutes|m)\s?((ago)?)/;
    var m = str.match(r);
    if (m) {
        var tvalue = parseInt(m[1]);
        switch(m[2][0]) {
            case "d":
                tvalue *= 24*3600;
                break;
            case "h":
                tvalue *= 3600;
                break;
            case "m":
                tvalue *= 60;
                break;
            default:
                throw new Error(" invalidate date");
        }
        return  new Date(now - tvalue*1000);
    } else {
        return new Date(str);
    }

}
function log()
{
    rl.pause();
    rl.clearLine(process.stdout);
    var str =_.map(arguments).join(" ");
    process.stdout.write(str);
    rl.resume();
}

var rootFolder   = null;

var nodePath = [];
var nodePathName = [];
var lowerFirstLetter = opcua.utils.lowerFirstLetter;


function setCurrentNode(node) {

    curNode = node;
    var curNodeBrowseName = lowerFirstLetter(curNode.browseName.name.toString());
    nodePathName.push(curNodeBrowseName);
    nodePath.push(node);
    curNodeCompletion = node.$components.map(function(c) {
        if (!c.browseName) {
            return "???";
        }
        return lowerFirstLetter(c.browseName.name.toString());
    });
    the_prompt = nodePathName.join(".").yellow+">";
    rl.setPrompt(the_prompt);
}
function setRootNode(node) {
    nodePath = [];
    nodePathName = [];
    setCurrentNode(node);
}
function moveToChild(browseName) {

    if (browseName === "..") {
        nodePathName.pop();
        curNode = nodePath.splice(-1,1)[0];
        the_prompt = nodePathName.join(".").yellow+">";
        rl.setPrompt(the_prompt);
        return;
    }
    var child= curNode[browseName];
    if (!child) {
        return;
    }
    setCurrentNode(child);
}
function get_root_folder(callback) {

    if(!rootFolder) {

        rl.pause();
        proxyManager.getObject(opcua.makeNodeId(opcua.ObjectIds.RootFolder),function(err,data) {

            if (!err) {
                rootFolder = data;
                assert(rootFolder,"expecting rootFolder");
                setRootNode(rootFolder);
                rl.resume();
            }
            callback();
        });
    } else {
        setCurrentNode(rootFolder);
        callback();
    }
}


client.on("send_chunk", function (message_chunk) {
    if (dumpMessageChunk) {
        process.stdout.write(">> " + message_chunk.length + "\r");
    }
});

client.on("receive_chunk", function (message_chunk) {
    if (dumpMessageChunk) {
        process.stdout.write("<< " + message_chunk.length + "\r");
    }
});

client.on("send_request", function (message) {
    if (dumpPacket) {
        log(" sending request".red);
        opcua.analyze_object_binary_encoding(message);
    }
});

client.on("receive_response", function (message) {
    if (dumpPacket) {
        assert(message);
        log(" receive response".cyan.bold);
        opcua.analyze_object_binary_encoding(message);
    }
});


function dumpNodeResult(node) {
    var str = sprintf("    %-30s%s%s", node.browseName.name, (node.isForward ? "->" : "<-"), node.nodeId.displayText());
    log(str);
}
function colorize(value) {
    return ("" + value).yellow.bold;
}


if (rl.history) {

    if (fs.existsSync(history_file)) {
        lines = fs.readFileSync(history_file, "ascii");
        lines = lines.split(/\r\n|\n/);
    }
    if (lines.length === 0) {
        var hostname = require("os").hostname();
        hostname = hostname.toLowerCase();
        rl.history.push("open opc.tcp://opcua.demo-this.com:51210/UA/SampleServer");
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

process.on("uncaughtException", function (e) {
    util.puts(e.stack.red);
    rl.prompt();
});




function apply_command(cmd,func,callback) {
    callback = callback || function(){};
    rl.pause();
    func(function(err) {
        callback();
        rl.resume();
        rl.prompt(the_prompt);
    });
}

function apply_on_valid_session(cmd, func ,callback) {

    assert(_.isFunction(func));
    assert(func.length === 2);

    if (the_session) {
        apply_command(cmd,function(callback) {
            func(the_session,callback);
        });
    } else {
        log("command : ", cmd.yellow, " requires a valid session , use createSession first");
    }
}

function dump_dataValues(nodesToRead, dataValues) {
    for (var i = 0; i < dataValues.length; i++) {
        var dataValue = dataValues[i];
        log("           Node : ", (nodesToRead[i].nodeId.toString()).cyan.bold, nodesToRead[i].attributeId.toString());
        if (dataValue.value) {
            log("           type : ", colorize(dataValue.value.dataType.key));
            log("           value: ", colorize(dataValue.value.value));
        } else {
            log("           value: <null>");
        }
        log("      statusCode: 0x", dataValue.statusCode.toString(16));
        log(" sourceTimestamp: ", dataValue.sourceTimestamp, dataValue.sourcePicoseconds);
    }
}

function dump_historyDataValues(nodeToRead,startDate,endDate, historyReadResult) {

    log("           Node : ", (nodeToRead.nodeId.toString()).cyan.bold, nodeToRead.attributeId.toString());
    log("      startDate : ",startDate);
    log("        endDate : ",endDate);
    if (historyReadResult.statusCode !== opcua.StatusCodes.Good) {
        log("                          error ",historyReadResult.statusCode.toString());
        return;
    }

    log("historyReadResult = ",historyReadResult.toString());

    var dataValues = historyReadResult.historyData.dataValues;
    log(" Length = ",dataValues.length);

    if (!dataValues || dataValues.length === 0) {
        log("                          No Data");
        return;
    }
    if (dataValues.length > 0 && dataValues[0].value) {
        log("           type : ", colorize(dataValues[0].value.dataType.key));
    }
    for (var i = 0; i < dataValues.length; i++) {
        var dataValue = dataValues[i];
        if (dataValue.value) {
            log(
              dataValue.sourceTimestamp,
              w(dataValue.sourcePicoseconds,4),
              colorize(w(dataValue.value.value,15)),
              w(dataValue.statusCode.toString(16),16));
        } else {
            log("           value: <null>" , dataValue.toString());
        }
    }
}

function open_session(callback) {


    if (the_session !== null) {
        log(" a session exists already ! use closeSession First");
        return callback();

    } else {

        client.requestedSessionTimeout = sessionTimeout;
        client.createSession(function (err, session) {
            if (err) {
                log("Error : ".red, err);
            } else {

                the_session = session;
                log("session created ", session.sessionId.toString());
                proxyManager = new UAProxyManager(the_session);

                the_prompt = "session:".cyan + the_session.sessionId.toString().yellow + ">".cyan;
                rl.setPrompt(the_prompt);

                assert(!crawler);

                rl.prompt(the_prompt);

            }
            callback();
        });
        client.on("close", function () {
            log(" Server has disconnected ".red);
            the_session = null;
            crawler = null;
        });
    }
}

function close_session(outer_callback) {
    apply_on_valid_session("closeSession", function (session,inner_callback) {
        session.close(function (err) {
            the_session = null;
            crawler = null;
            if (!outer_callback) {
                inner_callback(err);
            } else {
                assert(_.isFunction(outer_callback));
                outer_callback(inner_callback);
            }
        });
    });
}

function set_debug(flag) {
    if (flag) {
        dumpPacket = true;
        process.env.DEBUG = "ALL";
        log(" Debug is ON");
    } else {
        dumpPacket = true;
        delete process.env.DEBUG;
        log(" Debug is OFF");
    }
}

function process_line(line) {
    var nodes;
    var args = line.trim().split(/ +/);
    var cmd = args[0];

    if (curNode) {
        moveToChild(cmd);
        return;
    }
    switch (cmd) {
        case "debug":
            var flag = (!args[1]) ? true : ( ["ON", "TRUE", "1"].indexOf(args[1].toUpperCase()) >= 0);
            set_debug(flag);
            break;
        case "open":
            var endpoint_url = args[1];
            if (!endpoint_url.match(/^opc.tcp:\/\//)) {
                endpoint_url = "opc.tcp://" + endpoint_url;
            }
            var p = opcua.parseEndpointUrl(endpoint_url);
            var hostname = p.hostname;
            var port = p.port;
            log(" open    url : ", endpoint_url);
            log("    hostname : ", (hostname || "<null>").yellow);
            log("        port : ", port.toString().yellow);

            apply_command(cmd,function(callback) {


                client.connect(endpoint_url, function (err) {
                    if (err) {
                        log("client connected err=", err);
                    } else {
                        log("client connected : ", "OK".green);

                        add_endpoint_to_history(endpoint_url);

                        save_history(function () {
                        });
                    }
                    callback(err);
                });
            });
            break;

        case "fs":
        case "FindServers":
            apply_command(cmd,function(callback){
                client.findServers({}, function (err, servers) {
                    if (err) {
                        log(err.message);
                    }
                    log(treeify.asTree(servers, true));
                    callback(err);
                });
            });
            break;
        case "gep":
        case "getEndpoints":
            apply_command(cmd,function(callback){
                client.getEndpointsRequest(function (err, endpoints) {
                    if (err) {
                        log(err.message);
                    }
                    endpoints = utils.replaceBufferWithHexDump(endpoints);
                    log(treeify.asTree(endpoints, true));
                    callback(err);
                });
            });
            break;

        case "createSession":
        case "cs":
            apply_command(cmd,open_session);
            break;

        case "closeSession":
            close_session(function() { });
            break;

        case "disconnect":
            if (the_session) {
                close_session(function (callback) {
                    client.disconnect(function () {
                        rl.write("client disconnected");
                        callback();
                    });
                });
            } else {
                client.disconnect(function () {
                    rl.write("client disconnected");
                });
            }
            break;

        case "b":
        case "browse":
            apply_on_valid_session(cmd, function (the_session,callback) {

                nodes = [args[1]];

                the_session.browse(nodes, function (err, nodeResults) {

                    if (err) {
                        log(err);
                        log(nodeResults);
                    } else {

                        save_history(function () {
                        });

                        for (var i = 0; i < nodeResults.length; i++) {
                            log("Node: ", nodes[i]);
                            log(" StatusCode =", nodeResults[i].statusCode.toString(16));
                            nodeResults[i].references.forEach(dumpNodeResult);
                        }
                    }
                    callback();
                });

            });

            break;

        case "rootFolder":

            apply_on_valid_session(cmd, function (the_session,callback) {

                get_root_folder(callback);
            });
            break;

        case "hr":
        case "readHistoryValue":
            apply_on_valid_session(cmd, function (the_session,callback ) {

                // example:
                // hr ns=2;s=Demo.History.DoubleWithHistory 13:45 13:59
                nodes = [args[1]];

                var startTime = toDate(args[2]);// "2015-06-10T09:00:00.000Z"
                var endTime = toDate(args[3]);  // "2015-06-10T09:01:00.000Z"
                if (startTime>endTime) {
                    var tmp = endTime;endTime = startTime;startTime =tmp;
                }
                nodes = nodes.map(opcua.coerceNodeId);

                the_session.readHistoryValue(nodes,startTime,endTime, function (err, historyReadResults) {
                    if (err) {
                        log(err);
                        log(historyReadResults.toString());
                    } else {
                        save_history(function () {});
                        assert(historyReadResults.length === 1);
                        dump_historyDataValues({
                            nodeId: nodes[0],
                            attributeId: 13
                        }, startTime,endTime,historyReadResults[0]);
                    }
                    callback();

                });

            });
            break;
        case "r":
        case "read":
            apply_on_valid_session(cmd, function (the_session,callback ) {

                nodes = [args[1]];
                nodes = nodes.map(opcua.coerceNodeId);

                the_session.readVariableValue(nodes, function (err, dataValues) {
                    if (err) {
                        log(err);
                        log(dataValues);
                    } else {
                        save_history(function () {
                        });
                        dump_dataValues([{
                            nodeId: nodes[0],
                            attributeId: 13
                        }], dataValues);
                    }
                    callback();
                });
            });
            break;
        case "ra":
        case "readall":
            apply_on_valid_session(cmd, function (the_session, callback) {
                nodes = [args[1]];

                the_session.readAllAttributes(nodes, function (err, nodesToRead, dataValues/*,diagnosticInfos*/) {
                    if (!err) {
                        save_history(function () {
                        });
                        dump_dataValues(nodesToRead, dataValues);
                    }
                    callback();
                });
            });
            break;

        case "tb":
            apply_on_valid_session(cmd, function (the_session, callback) {

                var path = args[1];
                the_session.translateBrowsePath(path, function (err, results) {
                    if (err) {
                        log(err.message);
                    }
                    log(" Path ", path, " is ");
                    log(util.inspect(results, {colors: true, depth: 100}));

                    callback();
                });
            });
            break;
        case "crawl":
        {
            apply_on_valid_session(cmd, function (the_session, callback) {

                if (!crawler) {
                    crawler = new opcua.NodeCrawler(the_session);
                    crawler.on("browsed", function (element) {
                        // log("->",element.browseName.name,element.nodeId.toString());
                    });

                }

                var nodeId = args[1] || "ObjectsFolder";
                log("now crawling " + nodeId.yellow + " ...please wait...");
                crawler.read(nodeId, function (err, obj) {
                    if (!err) {
                        log(" crawling done ");
                        // todo : treeify.asTree performance is *very* slow on large object, replace with better implementation
                        //xx log(treeify.asTree(obj, true));
                        treeify.asLines(obj, true, true, function (line) {
                            log(line);
                        });
                    } else {
                        log("err ", err.message);
                    }
                    crawler = null;
                    callback();
                });
            });
        }
            break;

        case ".info":

            log("            bytesRead  ", client.bytesRead, " bytes");
            log("         bytesWritten  ", client.bytesWritten, " bytes");
            log("transactionsPerformed  ", client.transactionsPerformed, "");
            // -----------------------------------------------------------------------
            // number of subscriptions
            // -----------------------------------------------------------------------
            // number of monitored items by subscription

            break;
        case ".quit":
            process.exit(0);
            break;
        default:
            if (cmd.trim().length>0) {
                log("Say what? I might have heard `" + cmd.trim() + "`");
            }
            break;
    }
}

rl.on("line", function (line) {

    try {
        process_line(line);
        rl.prompt();
    }
    catch (err) {
        log("------------------------------------------------".red);
        log(err.message.bgRed.yellow.bold);
        log(err.stack);
        log("------------------------------------------------".red);
        rl.resume();
    }
});




