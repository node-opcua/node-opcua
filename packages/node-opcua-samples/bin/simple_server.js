#!/usr/bin/env node
/* eslint no-process-exit: 0 */
"use strict";
const path = require("path");
const _ = require("underscore");
const assert = require("assert");
const opcua = require("node-opcua");
const chalk = require("chalk");

Error.stackTraceLimit = Infinity;

function constructFilename(filename) {
    return path.join(__dirname,"../",filename);
}

const yargs = require("yargs/yargs");

const argv = yargs(process.argv)
    .wrap(132)

    .string("alternateHostname")
    .describe("alternateHostname")

    .number("port")
    .default("port",26543)

    .number("maxAllowedSessionNumber")
    .describe("maxAllowedSessionNumber","the maximum number of concurrent client session that the server will accept")
    .default("maxAllowedSessionNumber",500)

    .number("maxAllowedSubscriptionNumber")
    .describe("maxAllowedSubscriptionNumber","the maximum number of concurrent subscriptions")

    .boolean("silent")
    .default("silent",false)
    .describe("silent","no trace")


    .number("keySize")
    .describe("keySize","certificate keySize [1024|2048|3072|4096]")
    .default("keySize",2048)
    .alias("k","keySize")

    .string("applicationName")
    .describe("applicationName","the application name")
    .default("applicationName","NodeOPCUA-Server")

    .alias("a", "alternateHostname")
    .alias("m", "maxAllowedSessionNumber")
    .alias("n","applicationName")
    .alias("p", "port")

    .help(true)
    .argv;

const OPCUAServer = opcua.OPCUAServer;
const Variant = opcua.Variant;
const DataType = opcua.DataType;
const DataValue = opcua.DataValue;
const get_fully_qualified_domain_name = opcua.get_fully_qualified_domain_name;
const makeApplicationUrn = opcua.makeApplicationUrn;

const install_optional_cpu_and_memory_usage_node = opcua.install_optional_cpu_and_memory_usage_node;


const port = argv.port;
const maxAllowedSessionNumber   = argv.maxAllowedSessionNumber;
const maxConnectionsPerEndpoint = maxAllowedSessionNumber;
const maxAllowedSubscriptionNumber = argv.maxAllowedSubscriptionNumber  || 50;
opcua.OPCUAServer.MAX_SUBSCRIPTION = maxAllowedSubscriptionNumber;

const userManager = {
    isValidUser: function (userName, password) {

        if (userName === "user1" && password === "password1") {
            return true;
        }
        if (userName === "user2" && password === "password2") {
            return true;
        }
        return false;
    }
};



const keySize = argv.keySize;

const server_certificate_file              = constructFilename("certificates/server_selfsigned_cert_"+ keySize +".pem");
const server_certificate_privatekey_file   = constructFilename("certificates/server_key_"+ keySize +".pem");


console.log(" server certificate : ", server_certificate_file);

const productUri= argv.applicationName || "NodeOPCUA-Server";
const server_options = {

    certificateFile: server_certificate_file,
    privateKeyFile: server_certificate_privatekey_file,

    port: port,
    //xx (not used: causes UAExpert to get confused) resourcePath: "UA/Server",

    maxAllowedSessionNumber: maxAllowedSessionNumber,
    maxConnectionsPerEndpoint: maxConnectionsPerEndpoint,

    nodeset_filename: [
        opcua.nodesets.standard_nodeset_file,
        opcua.nodesets.di_nodeset_filename
    ],

    serverInfo: {
        applicationName: {text: "NodeOPCUA" ,locale: "en"},
        applicationUri: makeApplicationUrn(get_fully_qualified_domain_name(), productUri),
        gatewayServerUri: null,
        productUri: productUri,
        discoveryProfileUri: null,
        discoveryUrls: []
    },
    buildInfo: {
        buildNumber: "1234"
    },
    serverCapabilities: {
        maxBrowseContinuationPoints: 10,
        maxHistoryContinuationPoints: 10,
        // maxInactiveLockTime
        operationLimits: {
            maxNodesPerRead: 1000,
            maxNodesPerWrite: 1000,
            maxNodesPerHistoryReadData: 100,
            maxNodesPerBrowse: 1000,
        }
    },
    userManager: userManager,
    
    isAuditing: false,

    //xx registerServerMethod: opcua.RegisterServerMethod.HIDDEN,
    //xx registerServerMethod: opcua.RegisterServerMethod.MDNS,
    registerServerMethod: opcua.RegisterServerMethod.LDS,

};

process.title = "Node OPCUA Server on port : " + server_options.port;

server_options.alternateHostname = argv.alternateHostname;

const server = new OPCUAServer(server_options);

const endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;

const hostname = require("os").hostname();


server.on("post_initialize", function () {

    opcua.build_address_space_for_conformance_testing(server.engine.addressSpace);

    install_optional_cpu_and_memory_usage_node(server);

    const addressSpace = server.engine.addressSpace;

    const rootFolder = addressSpace.findNode("RootFolder");
    assert(rootFolder.browseName.toString() === "Root");

    const namespace = addressSpace.getOwnNamespace();

    const myDevices = namespace.addFolder(rootFolder.objects, {browseName: "MyDevices"});


    /*
     * variation 0:
     * ------------
     *
     * Add a variable in folder using a raw Variant.
     * Use this variation when the variable has to be read or written by the OPCUA clients
     */
    const variable0 = namespace.addVariable({
        organizedBy: myDevices,
        browseName: "FanSpeed",
        nodeId: "ns=1;s=FanSpeed",
        dataType: "Double",
        value: new Variant({dataType: DataType.Double, value: 1000.0})
    });

    setInterval(function () {
        const fluctuation = Math.random() * 100 - 50;
        variable0.setValueFromSource(new Variant({dataType: DataType.Double, value: 1000.0 + fluctuation}));
    }, 10);


    /*
     * variation 1:
     * ------------
     *
     * Add a variable in folder using a single get function which returns the up to date variable value in Variant.
     * The server will set the timestamps automatically for us.
     * Use this variation when the variable value is controlled by the getter function
     * Avoid using this variation if the variable has to be made writable, as the server will call the getter
     * function prior to returning its value upon client read requests.
     */
    namespace.addVariable({
        organizedBy: myDevices,
        browseName: "PumpSpeed",
        nodeId: "ns=1;s=PumpSpeed",
        dataType: "Double",
        value: {
            /**
             * returns the  current value as a Variant
             * @method get
             * @return {Variant}
             */
            get: function () {
                const pump_speed = 200 + 100 * Math.sin(Date.now() / 10000);
                return new Variant({dataType: DataType.Double, value: pump_speed});
            }
        }
    });

    namespace.addVariable({
        organizedBy: myDevices,
        browseName: "SomeDate",
        nodeId: "ns=1;s=SomeDate",
        dataType: "DateTime",
        value: {
            get: function () {
                return new Variant({dataType: DataType.DateTime, value: new Date(Date.UTC(2016, 9, 13, 8, 40, 0))});
            }
        }
    });


    /*
     * variation 2:
     * ------------
     *
     * Add a variable in folder. This variable gets its value and source timestamps from the provided function.
     * The value and source timestamps are held in a external object.
     * The value and source timestamps are updated on a regular basis using a timer function.
     */
    const external_value_with_sourceTimestamp = new opcua.DataValue({
        value: new Variant({dataType: DataType.Double, value: 10.0}),
        sourceTimestamp: null,
        sourcePicoseconds: 0
    });
    setInterval(function () {
        external_value_with_sourceTimestamp.value.value = Math.random();
        external_value_with_sourceTimestamp.sourceTimestamp = new Date();
    }, 1000);

    namespace.addVariable({
        organizedBy: myDevices,
        browseName: "Pressure",
        nodeId: "ns=1;s=Pressure",
        dataType: "Double",
        value: {
            timestamped_get: function () {
                return external_value_with_sourceTimestamp;
            }
        }
    });


    /*
     * variation 3:
     * ------------
     *
     * Add a variable in a folder. This variable gets its value  and source timestamps from the provided
     * asynchronous function.
     * The asynchronous function is called only when needed by the opcua Server read services and monitored item services
     *
     */

    namespace.addVariable({
        organizedBy: myDevices,
        browseName: "Temperature",
        nodeId: "s=Temperature",
        dataType: "Double",

        value: {
            refreshFunc: function (callback) {

                const temperature = 20 + 10 * Math.sin(Date.now() / 10000);
                const value = new Variant({dataType: DataType.Double, value: temperature});
                const sourceTimestamp = new Date();

                // simulate a asynchronous behaviour
                setTimeout(function () {
                    callback(null, new DataValue({value: value, sourceTimestamp: sourceTimestamp}));
                }, 100);
            }
        }
    });

    // UAAnalogItem
    // add a UAAnalogItem
    const node = namespace.addAnalogDataItem({

        organizedBy: myDevices,

        nodeId: "s=TemperatureAnalogItem",
        browseName: "TemperatureAnalogItem",
        definition: "(tempA -25) + tempB",
        valuePrecision: 0.5,
        engineeringUnitsRange: {low: 100, high: 200},
        instrumentRange: {low: -100, high: +200},
        engineeringUnits: opcua.standardUnits.degree_celsius,
        dataType: "Double",
        value: {
            get: function () {
                return new Variant({dataType: DataType.Double, value: Math.random() + 19.0});
            }
        }
    });


   const m3x3 =  namespace.addVariable({
        organizedBy: addressSpace.rootFolder.objects,
        nodeId: "s=Matrix",
        browseName: "Matrix",
        dataType: "Double",
        valueRank: 2,
        arrayDimensions: [3, 3],
        value: {
            get: function(){
                return new opcua.Variant({
                    dataType: opcua.DataType.Double,
                    arrayType: opcua.VariantArrayType.Matrix,
                    dimensions: [3, 3],
                    value: [1, 2, 3, 4, 5, 6, 7, 8, 9]
                });
            }
        }
    });

    const xyz =  namespace.addVariable({
        organizedBy: addressSpace.rootFolder.objects,
        nodeId: "s=Position",
        browseName: "Position",
        dataType: "Double",
        valueRank: 1,
        arrayDimensions: null,
        value: {
            get: function(){
                return new opcua.Variant({
                    dataType: opcua.DataType.Double,
                    arrayType: opcua.VariantArrayType.Array,
                    value: [1, 2, 3, 4]
                });
            }
        }
    });


    //------------------------------------------------------------------------------
    // Add a view
    //------------------------------------------------------------------------------
    const view = namespace.addView({
        organizedBy: rootFolder.views,
        browseName: "MyView"
    });

    view.addReference({
        referenceType:"Organizes",
        nodeId: node.nodeId
    });

});


function dumpObject(obj) {
    function w(str, width) {
        const tmp = str + "                                        ";
        return tmp.substr(0, width);
    }

    return _.map(obj, function (value, key) {
        return "      " + w(key, 30).green + "  : " + ((value === null) ? null : value.toString());
    }).join("\n");
}


console.log(chalk.yellow("  server PID          :"), process.pid);
console.log(chalk.yellow("  silent              :"), argv.silent);

server.start(function (err) {
    if (err) {
        console.log(" Server failed to start ... exiting");
        process.exit(-3);
    }
    console.log(chalk.yellow("  server on port      :"), server.endpoints[0].port.toString());
    console.log(chalk.yellow("  endpointUrl         :"), endpointUrl);

    console.log(chalk.yellow("  serverInfo          :"));
    console.log(dumpObject(server.serverInfo));
    console.log(chalk.yellow("  buildInfo           :"));
    console.log(dumpObject(server.engine.buildInfo));

    console.log(chalk.yellow("\n  server now waiting for connections. CTRL+C to stop"));

    if (argv.silent) {
        console.log(" silent");
        console.log = function() {};
    }
    //  console.log = function(){};

});

server.on("create_session", function (session) {
    console.log(" SESSION CREATED");
    console.log(chalk.cyan("    client application URI: "), session.clientDescription.applicationUri);
    console.log(chalk.cyan("        client product URI: "), session.clientDescription.productUri);
    console.log(chalk.cyan("   client application name: "), session.clientDescription.applicationName.toString());
    console.log(chalk.cyan("   client application type: "), session.clientDescription.applicationType.toString());
    console.log(chalk.cyan("              session name: "), session.sessionName ? session.sessionName.toString() : "<null>");
    console.log(chalk.cyan("           session timeout: "), session.sessionTimeout);
    console.log(chalk.cyan("                session id: "), session.sessionId);
});

server.on("session_closed", function (session, reason) {
    console.log(" SESSION CLOSED :", reason);
    console.log(chalk.cyan("              session name: "), session.sessionName ? session.sessionName.toString() : "<null>");
});

function w(s, w) {
    return ("000" + s).substr(-w);
}
function t(d) {
    return w(d.getHours(), 2) + ":" + w(d.getMinutes(), 2) + ":" + w(d.getSeconds(), 2) + ":" + w(d.getMilliseconds(), 3);
}

server.on("response", function (response) {

    if (argv.silent) { return;}

    console.log(t(response.responseHeader.timestamp), response.responseHeader.requestHandle,
        response.schema.name, " status = ", response.responseHeader.serviceResult.toString());
    switch (response.schema.name) {
        case "xxModifySubscriptionResponse":
        case "xxCreateMonitoredItemsResponse":
        case "xxModifyMonitoredItemsResponse":
        case "xxRepublishResponse":
        case "xxCreateSessionResponse":
        case "xxActivateSessionResponse":
        case "xxCloseSessionResponse":
        case "xxBrowseResponse":
        case "xxCreateSubscriptionResponse":
        case "xxTranslateBrowsePathsToNodeIdsResponse":
        case "xxSetPublishingModeResponse":
        case "WriteResponse":
            console.log(response.toString());
            break;
        case "xxPublishResponse":
            console.log(response.toString());
            console.log("PublishResponse.subscriptionId = ",response.subscriptionId.toString());
            break;
    }

});

function indent(str, nb) {
    const spacer = "                                             ".slice(0, nb);
    return str.split("\n").map(function (s) {
        return spacer + s;
    }).join("\n");
}
server.on("request", function (request, channel) {

    if (argv.silent) { return;}

    console.log(t(request.requestHeader.timestamp), request.requestHeader.requestHandle,
        request.schema.name, " ID =", channel.channelId.toString());
    switch (request.schema.name) {
        case "xxModifySubscriptionRequest":
        case "xxCreateMonitoredItemsRequest":
        case "xxModifyMonitoredItemsRequest":
        case "xxRepublishRequest":
            console.log(request.toString());
            break;
        case "xxReadRequest":
            const str = "    ";
            if (request.nodesToRead) {
                request.nodesToRead.map(function (node) {
                    str += node.nodeId.toString() + " " + node.attributeId + " " + node.indexRange;
                });
            }
            console.log(str);
            break;
        case "WriteRequest":
            console.log(request.toString());
           break;
           if (request.nodesToWrite) {
                const lines = request.nodesToWrite.map(function (node) {
                    return "     " + node.nodeId.toString().green + " " + node.attributeId + " " + node.indexRange + "\n" + indent("" + node.value.toString(), 10) + "\n";
                });
                console.log(lines.join("\n"));
            }
            break;

        case "xxTranslateBrowsePathsToNodeIdsRequest":
        case "xxBrowseRequest":
        case "xxCreateSessionRequest":
        case "xxActivateSessionRequest":
        case "xxCloseSessionRequest":
        case "xxCreateSubscriptionRequest":
        case "xxSetPublishingModeRequest":
            // do special console output
            //console.log(util.inspect(request, {colors: true, depth: 10}));
            console.log(request.toString());
            break;
        case "xxPublishRequest":
            console.log(request.toString());
            break;
    }
});

process.on("SIGINT", function () {
    // only work on linux apparently
    console.error(chalk.red.bold(" Received server interruption from user "));
    console.error(chalk.red.bold(" shutting down ..."));
    server.shutdown(1000, function () {
        console.error(chalk.red.bold(" shutting down completed "));
        console.error(chalk.red.bold(" done "));
        console.error("");
        process.exit(-1);
    });
});

const discovery_server_endpointUrl = "opc.tcp://" + hostname + ":4840/UADiscovery";

console.log(chalk.yellow("\nregistering server to :") + discovery_server_endpointUrl);

server.on("serverRegistered",function() {
    console.log("server has been registered");
});
server.on("serverUnregistered",function() {
    console.log("server has been unregistered");
});
server.on("serverRegistrationRenewed",function() {
    console.log("server registration has been renewed");
});
server.on("serverRegistrationPending",function() {
    console.log("server registration is still pending (is Local Discovery Server up and running ?)");
});


server.on("newChannel",function(channel) {
    console.log(chalk.bgYellow("Client connected with address = "),channel.remoteAddress," port = ",channel.remotePort);
});

server.on("closeChannel",function(channel) {
    console.log(chalk.bgCyan("Client disconnected with address = "),channel.remoteAddress," port = ",channel.remotePort);
    if ( global.gc) {
        global.gc();
    }
});
