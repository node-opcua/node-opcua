"use strict";
require("requirish")._(module);
Error.stackTraceLimit = Infinity;

var argv = require('yargs')
    .wrap(132)
    .string("alternateHostname")
    .describe("alternateHostname")
    .alias('a','alternateHostname')
    .string("port")
    .describe("port")
    .alias('p','port')
    .argv;

var opcua = require("..");
var _ = require("underscore");
var OPCUAServer = opcua.OPCUAServer;
var Variant = opcua.Variant;
var DataType = opcua.DataType;


var address_space_for_conformance_testing = require("lib/simulation/address_space_for_conformance_testing");
var build_address_space_for_conformance_testing = address_space_for_conformance_testing.build_address_space_for_conformance_testing;

var install_optional_cpu_and_memory_usage_node = require("lib/server/vendor_diagnostic_nodes").install_optional_cpu_and_memory_usage_node;

var standard_nodeset_file = opcua.standard_nodeset_file;

var get_fully_qualified_domain_name = require("lib/misc/hostname").get_fully_qualified_domain_name;

var port = parseInt(argv.port) || 26543;

var userManager = {
    isValidUser: function (userName,password) {

        if (userName === "user1" && password === "password1") {
            return true;
        }
        if (userName === "user2" && password === "password2") {
            return true;
        }
        return false;
    }
};

var server_options ={

    port: port,
    resourcePath: "UA/Server",

    maxAllowedSessionNumber: 500,

    nodeset_filename: [ standard_nodeset_file],

    serverInfo: {
        applicationUri : "urn:"+ get_fully_qualified_domain_name(35)+ ":NodeOPCUA-Server",
        productUri:      "NodeOPCUA-SimpleDemoServer",
        applicationName: {text: "applicationName"},
        gatewayServerUri: null,
        discoveryProfileUri: null,
        discoveryUrls: []
    },
    buildInfo: {
        buildNumber: "1234"
    },
    serverCapabilities: {
        operationLimits: {
            maxNodesPerRead:   1000,
            maxNodesPerBrowse: 2000
        }
    },
    userManager: userManager
};

process.title ="Node OPCUA Server on port : " + server_options.port;

server_options.alternateHostname = argv.alternateHostname;

var server = new OPCUAServer(server_options);

var endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;

var hostname = require("os").hostname();

var discovery_server_endpointUrl = "opc.tcp://" + hostname + ":4840/UADiscovery";

console.log("\nregistering server to :".yellow + discovery_server_endpointUrl);

server.registerServer(discovery_server_endpointUrl, function (err) {
    if (err) {
        // cannot register server in discovery
        console.log("     warning : cannot register server into registry server".cyan);
    } else {
        console.log("     registering server to the discovery server : done.".cyan);
    }
    console.log("");
});



server.on("post_initialize", function () {

    build_address_space_for_conformance_testing(server.engine);

    install_optional_cpu_and_memory_usage_node(server);

    var myDevices = server.engine.createFolder("Objects", { browseName: "MyDevices"});

    /**
     * variation 1:
     * ------------
     *
     * Add a variable in folder using a single get function witch returns the up to date variable value in Variant.
     * The server will set the timestamps automatically for us.
     *
     */
    server.engine.addVariableInFolder(myDevices, {
        browseName: "PumpSpeed",
        nodeId: "ns=2;s=PumpSpeed",
        dataType: "Double",
        value: {
            /**
             * returns the  current value as a Variant
             * @method get
             * @return {Variant}
             */
            get: function() {
                var pump_speed = 200 + 100 * Math.sin(Date.now() / 10000);
                return new Variant({dataType: DataType.Double, value: pump_speed});
            }
        }
    });

    server.engine.addVariableInFolder(myDevices, {
        browseName: "SomeDate",
        nodeId: "ns=2;s=SomeDate",
        dataType: "DateTime",
        value: {
            get: function () {
                return new Variant({dataType: DataType.DateTime, value: new Date(Date.UTC(2016, 9, 13, 8, 40, 0))});
            }
        }
    });


    /**
     * variation 2:
     * ------------
     *
     * Add a variable in folder. This variable gets its value and source timestamps from the provided function.
     * The value and source timestamps are held in a external object.
     * The value and source timestamps are updated on a regular basis using a timer function.
     */
    var external_value_with_sourceTimestamp = new opcua.DataValue({
        value: new Variant({dataType: DataType.Double , value: 10.0}),
        sourceTimestamp : null,
        sourcePicoseconds: 0
    });
    setInterval(function() {
        external_value_with_sourceTimestamp.value.value = Math.random();
        external_value_with_sourceTimestamp.sourceTimestamp = new Date();
    },1000);

    server.engine.addVariableInFolder(myDevices, {
        browseName: "Pressure",
        nodeId: "ns=2;s=Pressure",
        dataType: "Double",
        value: {
            timestamped_get: function () {
                return external_value_with_sourceTimestamp;
            }
        }
    });


    /**
     * variation 3:
     * ------------
     *
     * Add a variable in a folder. This variable gets its value  and source timestamps from the provided asynchronous
     * function.
     * The asynchronous function is called only when needed by the opcua Server read services and monitored item services
     *
     */

    server.engine.addVariableInFolder(myDevices, {
        browseName: "Temperature",
        nodeId: "ns=2;s=Temperature",
        dataType: "Double",

        value: {
            refreshFunc: function (callback) {

                var temperature = 20 + 10 * Math.sin(Date.now() / 10000);
                var value = new Variant({dataType: DataType.Double, value: temperature});
                var sourceTimestamp = new Date();

                // simulate a asynchronous behaviour
                setTimeout(function () {
                    callback(null, new DataValue({ value:value, sourceTimestamp: sourceTimestamp}));
                }, 100);
            }
        }
    });

    // UAAnalogItem
    // add a UAAnalogItem
    var node = opcua.addAnalogDataItem(myDevices,{
        nodeId:"ns=4;s=TemperatureAnalogItem",
        browseName: "TemperatureAnalogItem",
        definition: "(tempA -25) + tempB",
        valuePrecision: 0.5,
        engineeringUnitsRange: { low: 100 , high: 200},
        instrumentRange: { low: -100 , high: +200},
        engineeringUnits: opcua.standardUnits.degree_celsius,
        dataType: "Double",
        value: {
            get: function(){
                return new Variant({dataType: DataType.Double , value: Math.random() + 19.0});
            }
        }
    });

});

function w(str,width) { return (str+ "                            ").substr(0,width);}

function dumpObject(obj) {
 return   _.map(obj,function(value,key) {
     return  w("          " + key,30).green + "       : " + ((value === null)? null : value.toString());
 }).join("\n");
}


console.log("  server PID          :".yellow, process.pid);

server.start(function (err) {
    if (err) {
        console.log(" Server failed to start ... exiting");
        process.exit(-3);
    }
    console.log("  server on port      :".yellow, server.endpoints[0].port.toString().cyan);
    console.log("  endpointUrl         :".yellow, endpointUrl.cyan);

    console.log("  serverInfo          :".yellow);
    console.log(dumpObject(server.serverInfo));
    console.log("  buildInfo           :".yellow);
    console.log(dumpObject(server.engine.buildInfo));

    console.log("\n  server now waiting for connections. CTRL+C to stop".yellow);
});

server.on("create_session",function(session) {

    console.log(" SESSION CREATED");
    console.log("    client application URI: ".cyan,session.clientDescription.applicationUri);
    console.log("        client product URI: ".cyan, session.clientDescription.productUri);
    console.log("   client application name: ".cyan,session.clientDescription.applicationName.toString());
    console.log("   client application type: ".cyan,session.clientDescription.applicationType.toString());
    console.log("              session name: ".cyan,session.sessionName.toString());
    console.log("           session timeout: ".cyan,session.sessionTimeout);
    console.log("                session id: ".cyan,session.sessionId);
});

server.on("session_closed",function(session,reason) {
    console.log(" SESSION CLOSED :",reason);
    console.log("              session name: ".cyan,session.sessionName.toString());
});


server.on("response", function (response) {
    console.log(response._schema.name.cyan," status = ",response.responseHeader.serviceResult.toString().cyan);
    switch (response._schema.name) {
        case "WriteResponse":
            var str = "   ";
            response.results.map(function (result) {
                str += result.toString();
            });
            console.log(str);
            break;
    };

});

function indent(str,nb) {
    var spacer = "                                             ".slice(0,nb);
    return str.split("\n").map(function(s) { return spacer + s }).join("\n");
}
server.on("request", function (request,channel) {
    console.log(request._schema.name.yellow, " ID =",channel.secureChannelId.toString().cyan);
    switch (request._schema.name) {
        case "ReadRequest":
            var str = "    ";
            request.nodesToRead.map(function (node) {
                str += node.nodeId.toString() + " " + node.attributeId + " " + node.indexRange;
            });
            console.log(str);
            break;
        case "WriteRequest":
            var lines  = request.nodesToWrite.map(function (node) {
                return "     " + node.nodeId.toString().green + " " + node.attributeId + " " + node.indexRange + "\n" + indent("" + node.value.toString(),10) + "\n";
            });
            console.log(lines.join("\n"));
            break;

        case "TranslateBrowsePathsToNodeIdsRequest":
            // do special console output
            //xx console.log(util.inspect(request, {colors: true, depth: 10}));
            break;
    }
});

process.on('SIGINT', function() {
    // only work on linux apparently
    console.log(" Received server interruption from user ".red.bold);
    console.log(" shutting down ...".red.bold);
    server.shutdown(1000, function () {
        console.log(" shutting down completed ".red.bold);
        console.log(" done ".red.bold);
        console.log("");
        process.exit(-1);
    });
});
