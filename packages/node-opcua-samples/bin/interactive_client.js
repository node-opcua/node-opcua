#!/usr/bin/env node
/* eslint-disable no-case-declarations */
/* eslint no-process-exit: 0 */
"use strict";
const chalk = require("chalk");
const treeify = require("treeify");
const sprintf = require("sprintf-js").sprintf;
const util = require("util");
const fs = require("fs");
const path = require("path");
const _ = require("underscore");

const opcua = require("node-opcua");
const UAProxyManager = opcua.UAProxyManager;
const DataType = opcua.DataType;



const utils = opcua.utils;

const { assert } = require("node-opcua-assert");

console.log(" Version ", opcua.version);

const sessionTimeout = 2 * 60 * 1000; // 2 minutes

const client = opcua.OPCUAClient.create({
    requestedSessionTimeout: sessionTimeout,
    keepSessionAlive: true
});

let the_session = null;
let proxyManager = null;

let crawler = null;
let dumpPacket = false;
const dumpMessageChunk = false;
let endpoints_history = [];

const endpoints_history_file = path.join(__dirname, ".history_endpoints");

let curNode = null;
let curNodeCompletion = [];

function save_endpoint_history(callback) {
    if (endpoints_history.length > 0) {
        fs.writeFileSync(endpoints_history_file, endpoints_history.join("\n"), "utf-8");
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

let lines = [];



if (fs.existsSync(endpoints_history_file)) {
    lines = fs.readFileSync(endpoints_history_file, "utf-8");
    endpoints_history = lines.split(/\r\n|\n/);
}

const history_file = path.join(__dirname, ".history");


function completer(line, callback) {

    let completions, hits;

    if ((line.trim() === "") && curNode) {
        // console.log(" completions ",completions);
        let c = [".."].concat(curNodeCompletion);
        if (curNodeCompletion.length === 1) {
            c = curNodeCompletion;
        }
        return callback(null, [c, line]);
    }

    if ("open".match(new RegExp("^" + line.trim()))) {
        completions = ["open localhost:port"];
        return callback(null, [completions, line]);

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
    hits = completions.filter(function(c) {
        return c.indexOf(line) === 0;
    });
    return callback(null, [hits.length ? hits : completions, line]);
}


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: completer
});

let the_prompt = chalk.cyan(">");
rl.setPrompt(the_prompt);
rl.prompt();

function save_history(callback) {
    const history_uniq = _.uniq(rl.history);
    fs.writeFileSync(history_file, history_uniq.join("\n"), "utf-8");
    callback();
}

function w(str, width) {
    return str.padEnd(width," ").substring(0, width);
}
/**
 * @method toDate
 * @param str
 *
 * @example
 *    toDate("now");
 *    toDate("13:00");      => today at 13:00
 *    toDate("1 hour ago"); => today one our ago....
 *
 * @return {Date}
 */
function toDate(str) {
    console.log(" parsing : '" + str + "'");
    const now = new Date();
    if (!str) {
        return now;
    }
    if (str.toLowerCase() === "now") {
        return now;
    }

    // check if provided date is  <HH>:<MM>

    const t = /([0-9]{1,2}):([0-9]{1,2})/;
    const tt = str.match(t);
    if (tt) {
        // HH:MM of current date
        const year = now.getFullYear();
        const month = now.getMonth(); // 0  : jan , 1: feb etc ...
        const day = now.getDate();
        const hours = parseInt(tt[1], 10);
        const minutes = parseInt(tt[2], 10);
        const seconds = 0;
        const date = new Date(year, month, day, hours, minutes, seconds);
        return date;
    }
    // check if provided date looks like "3 hours ago" | "1 day ago" etc...
    const r = /([0-9]*)(day|days|d|hours|hour|h|minutes|minutes|m)\s?((ago)?)/;
    const m = str.match(r);
    if (m) {
        let tvalue = parseInt(m[1], 10);
        switch (m[2][0]) {
            case "d":
                tvalue *= 24 * 3600;
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
        return new Date(now - tvalue * 1000);
    } else {
        return new Date(str);
    }

}
function log() {
    rl.pause();
    rl.clearLine(process.stdout);
    const str = _.map(arguments).join(" ");
    process.stdout.write(str);
    rl.resume();
}

let rootFolder = null;

let nodePath = [];
let nodePathName = [];
const lowerFirstLetter = opcua.utils.lowerFirstLetter;


function setCurrentNode(node) {

    curNode = node;
    const curNodeBrowseName = lowerFirstLetter(curNode.browseName.name.toString());
    nodePathName.push(curNodeBrowseName);
    nodePath.push(node);
    curNodeCompletion = node.$components.map(function(c) {
        if (!c.browseName) {
            return "???";
        }
        return lowerFirstLetter(c.browseName.name.toString());
    });
    the_prompt = chalk.yellow(nodePathName.join(".")) + ">";
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
        curNode = nodePath.splice(-1, 1)[0];
        the_prompt = chalk.yellow(nodePathName.join(".")) + ">";
        rl.setPrompt(the_prompt);
        return;
    }
    const child = curNode[browseName];
    if (!child) {
        return;
    }
    setCurrentNode(child);
}
function get_root_folder(callback) {

    if (!rootFolder) {

        rl.pause();
        proxyManager.getObject(opcua.makeNodeId(opcua.ObjectIds.RootFolder), function(err, data) {

            if (!err) {
                rootFolder = data;
                assert(rootFolder, "expecting rootFolder");
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


client.on("send_chunk", function(message_chunk) {
    if (dumpMessageChunk) {
        process.stdout.write(">> " + message_chunk.length + "\r");
    }
});

client.on("receive_chunk", function(message_chunk) {
    if (dumpMessageChunk) {
        process.stdout.write("<< " + message_chunk.length + "\r");
    }
});

client.on("send_request", function(message) {
    if (dumpPacket) {
        log(chalk.red(" sending request"));
        opcua.analyze_object_binary_encoding(message);
    }
});

client.on("receive_response", function(message) {
    if (dumpPacket) {
        assert(message);
        log(chalk.cyan.bold(" receive response"));
        opcua.analyze_object_binary_encoding(message);
    }
});


function dumpNodeResult(node) {
    const str = sprintf("    %-30s%s%s", node.browseName.name, (node.isForward ? "->" : "<-"), node.nodeId.displayText());
    log(str);
}
function colorize(value) {
    return chalk.yellow.bold("" + value);
}


if (rl.history) {

    if (fs.existsSync(history_file)) {
        lines = fs.readFileSync(history_file, "utf-8");
        lines = lines.split(/\r\n|\n/);
    }
    if (lines.length === 0) {
        let hostname = require("os").hostname();
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

process.on("uncaughtException", function(e) {
    util.puts(e.stack.red);
    rl.prompt();
});




function apply_command(cmd, func, callback) {
    callback = callback || function() { };
    rl.pause();
    func(function(err) {
        callback();
        rl.resume();
        rl.prompt(the_prompt);
    });
}

function apply_on_valid_session(cmd, func, callback) {

    assert(typeof func === "function");
    assert(func.length === 2);

    if (the_session) {
        apply_command(cmd, function(callback) {
            func(the_session, callback);
        });
    } else {
        log("command : ", chalk.yellow(cmd), " requires a valid session , use createSession first");
    }
}

function dump_dataValues(nodesToRead, dataValues) {
    for (let i = 0; i < dataValues.length; i++) {
        const dataValue = dataValues[i];
        log("           Node : ", chalk.cyan.bold((nodesToRead[i].nodeId.toString())), nodesToRead[i].attributeId.toString());
        if (dataValue.value) {
            log("           type : ", colorize(DataType[dataValue.value.dataType]));
            log("           value: ", colorize(dataValue.value.value));
        } else {
            log("           value: <null>");
        }
        log("      statusCode: 0x", dataValue.statusCode.toString(16));
        log(" sourceTimestamp: ", dataValue.sourceTimestamp, dataValue.sourcePicoseconds);
    }
}

function dump_historyDataValues(nodeToRead, startDate, endDate, historyReadResult) {

    log("           Node : ", chalk.cyan.bold((nodeToRead.nodeId.toString())), nodeToRead.attributeId.toString());
    log("      startDate : ", startDate);
    log("        endDate : ", endDate);
    if (historyReadResult.statusCode !== opcua.StatusCodes.Good) {
        log("                          error ", historyReadResult.statusCode.toString());
        return;
    }

    log("historyReadResult = ", historyReadResult.toString());

    const dataValues = historyReadResult.historyData.dataValues;
    log(" Length = ", dataValues.length);

    if (!dataValues || dataValues.length === 0) {
        log("                          No Data");
        return;
    }
    if (dataValues.length > 0 && dataValues[0].value) {
        log("           type : ", colorize(DataType[dataValues[0].value.dataType]));
    }
    for (let i = 0; i < dataValues.length; i++) {
        const dataValue = dataValues[i];
        if (dataValue.value) {
            log(
                dataValue.sourceTimestamp,
                w(dataValue.sourcePicoseconds, 4),
                colorize(w(dataValue.value.value, 15)),
                w(dataValue.statusCode.toString(16), 16));
        } else {
            log("           value: <null>", dataValue.toString());
        }
    }
}

function open_session(callback) {


    if (the_session !== null) {
        log(" a session exists already ! use closeSession First");
        return callback();

    } else {

        client.requestedSessionTimeout = sessionTimeout;
        client.createSession(function(err, session) {
            if (err) {
                log(chalk.red("Error : "), err);
            } else {

                the_session = session;
                log("session created ", session.sessionId.toString());
                proxyManager = new UAProxyManager(the_session);

                the_prompt = chalk.cyan("session:") + chalk.yellow(the_session.sessionId.toString()) + chalk.cyan(">");
                rl.setPrompt(the_prompt);

                assert(!crawler);

                rl.prompt(the_prompt);

            }
            callback();
        });
        client.on("close", function() {
            log(chalk.red(" Server has disconnected "));
            the_session = null;
            crawler = null;
        });
    }
}

function close_session(outer_callback) {
    apply_on_valid_session("closeSession", function(session, inner_callback) {
        session.close(function(err) {
            the_session = null;
            crawler = null;
            if (!outer_callback) {
                inner_callback(err);
            } else {
                assert(typeof outer_callback === "function");
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
    let nodes;
    const args = line.trim().split(/ +/);
    const cmd = args[0];

    if (curNode) {
        moveToChild(cmd);
        return;
    }
    switch (cmd) {
        case "debug":
            const flag = (!args[1]) ? true : (["ON", "TRUE", "1"].indexOf(args[1].toUpperCase()) >= 0);
            set_debug(flag);
            break;
        case "open":
            let endpointUrl = args[1];
            if (!endpointUrl.match(/^opc.tcp:\/\//)) {
                endpointUrl = "opc.tcp://" + endpointUrl;
            }
            const p = opcua.parseEndpointUrl(endpointUrl);
            const hostname = p.hostname;
            const port = p.port;
            log(" open    url : ", endpointUrl);
            log("    hostname : ", chalk.yellow(hostname || "<null>"));
            log("        port : ", chalk.yellow(port.toString()));

            apply_command(cmd, function(callback) {


                client.connect(endpointUrl, function(err) {
                    if (err) {
                        log("client connected err=", err);
                    } else {
                        log("client connected : ", chalk.green("OK"));

                        add_endpoint_to_history(endpointUrl);

                        save_history(function() {
                        });
                    }
                    callback(err);
                });
            });
            break;

        case "fs":
        case "FindServers":
            apply_command(cmd, function(callback) {
                client.findServers({}, function(err, data) {
                    const { servers, endpoints } = data;
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
            apply_command(cmd, function(callback) {
                client.getEndpoints(function(err, endpoints) {
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
            apply_command(cmd, open_session);
            break;

        case "closeSession":
            close_session(function() { });
            break;

        case "disconnect":
            if (the_session) {
                close_session(function(callback) {
                    client.disconnect(function() {
                        rl.write("client disconnected");
                        callback();
                    });
                });
            } else {
                client.disconnect(function() {
                    rl.write("client disconnected");
                });
            }
            break;

        case "b":
        case "browse":
            apply_on_valid_session(cmd, function(the_session, callback) {

                nodes = [args[1]];

                the_session.browse(nodes, function(err, nodeResults) {

                    if (err) {
                        log(err);
                        log(nodeResults);
                    } else {

                        save_history(function() {
                        });

                        for (let i = 0; i < nodeResults.length; i++) {
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

            apply_on_valid_session(cmd, function(the_session, callback) {

                get_root_folder(callback);
            });
            break;

        case "hr":
        case "readHistoryValue":
            apply_on_valid_session(cmd, function(the_session, callback) {

                // example:
                // hr ns=2;s=Demo.History.DoubleWithHistory 13:45 13:59
                nodes = [args[1]];

                let startTime = toDate(args[2]);// "2015-06-10T09:00:00.000Z"
                let endTime = toDate(args[3]);  // "2015-06-10T09:01:00.000Z"
                if (startTime > endTime) {
                    const tmp = endTime; endTime = startTime; startTime = tmp;
                }
                nodes = nodes.map(opcua.coerceNodeId);

                the_session.readHistoryValue(nodes, startTime, endTime, function(err, historyReadResults) {
                    if (err) {
                        log(err);
                        log(historyReadResults.toString());
                    } else {
                        save_history(function() { });
                        assert(historyReadResults.length === 1);
                        dump_historyDataValues({
                            nodeId: nodes[0],
                            attributeId: 13
                        }, startTime, endTime, historyReadResults[0]);
                    }
                    callback();

                });

            });
            break;
        case "r":
        case "read":
            apply_on_valid_session(cmd, function(the_session, callback) {

                nodes = [args[1]];
                nodes = nodes.map(opcua.coerceNodeId);

                the_session.readVariableValue(nodes, function(err, dataValues) {
                    if (err) {
                        log(err);
                        log(dataValues);
                    } else {
                        save_history(function() {
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
            apply_on_valid_session(cmd, function(the_session, callback) {
                const node = args[1];

                the_session.readAllAttributes(node, function(err, result/*,diagnosticInfos*/) {
                    if (!err) {
                        save_history(function() {
                        });
                        console.log(result);
                        //xx dump_dataValues(nodesToRead, dataValues);
                    }
                    callback();
                });
            });
            break;

        case "tb":
            apply_on_valid_session(cmd, function(the_session, callback) {

                const path = args[1];
                the_session.translateBrowsePath(path, function(err, results) {
                    if (err) {
                        log(err.message);
                    }
                    log(" Path ", path, " is ");
                    log(util.inspect(results, { colors: true, depth: 100 }));

                    callback();
                });
            });
            break;
        case "crawl":
            {
                apply_on_valid_session(cmd, function(the_session, callback) {

                    if (!crawler) {
                        crawler = new opcua.NodeCrawler(the_session);
                        crawler.on("browsed", function(element) {
                            // log("->",element.browseName.name,element.nodeId.toString());
                        });

                    }

                    const nodeId = args[1] || "ObjectsFolder";
                    log("now crawling " + chalk.yellow(nodeId) + " ...please wait...");
                    crawler.read(nodeId, function(err, obj) {
                        if (!err) {
                            log(" crawling done ");
                            // todo : treeify.asTree performance is *very* slow on large object, replace with better implementation
                            //xx log(treeify.asTree(obj, true));
                            treeify.asLines(obj, true, true, function(line) {
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
            if (cmd.trim().length > 0) {
                log("Say what? I might have heard `" + cmd.trim() + "`");
            }
            break;
    }
}

rl.on("line", function(line) {

    try {
        process_line(line);
        rl.prompt();
    }
    catch (err) {
        log(chalk.red("------------------------------------------------"));
        log(chalk.bgRed.yellow.bold(err.message));
        log(err.stack);
        log(chalk.red("------------------------------------------------"));
        rl.resume();
    }
});




