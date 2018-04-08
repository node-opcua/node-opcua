#!/usr/bin/env node
"use strict";
const opcua = require("node-opcua");
const _ = require("underscore");

Error.stackTraceLimit = Infinity;

const assert = require("node-opcua-assert").assert;
const argv = require("yargs")
    .wrap(132)
    .string("alternateHostname")
    .describe("alternateHostname")
    .alias("a","alternateHostname")
    .string("port")
    .describe("port")
    .alias("p","port")
    .argv;

const OPCUAServer = opcua.OPCUAServer;
const Variant = opcua.Variant;
const DataType = opcua.DataType;

const makeApplicationUrn = opcua.makeApplicationUrn;
const standard_nodeset_file = opcua.standard_nodeset_file;
const get_fully_qualified_domain_name = opcua.get_fully_qualified_domain_name;

const port = parseInt(argv.port) || 26543;

const userManager = {
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


const server_options ={

    port: port,
    resourcePath: "UA/Server",

    maxAllowedSessionNumber: 1500,

    nodeset_filename: [
        standard_nodeset_file,
        opcua.di_nodeset_filename,
        opcua.adi_nodeset_filename
    ],

    serverInfo: {
        applicationUri : makeApplicationUrn(get_fully_qualified_domain_name(),"NodeOPCUA-Server"),
        productUri:      "NodeOPCUA-SimpleADIDemoServer",
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

const server = new OPCUAServer(server_options);

const endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;

const hostname = require("os").hostname();



server.on("post_initialize", function () {


    const addressSpace = server.engine.addressSpace;

    const rootFolder = addressSpace.findNode("RootFolder");
    assert(rootFolder.browseName.toString() === "Root");


    const deviceSet = rootFolder.objects.deviceSet;
    assert(deviceSet.browseName.toString() === "2:DeviceSet");

    const baseObjectType = addressSpace.findObjectType("BaseObjectType");

    const nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
    const topologyElementType    = addressSpace.findObjectType("TopologyElementType",nsDI);

    const nsADI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");

    const spectrometerDeviceType = addressSpace.findObjectType("SpectrometerDeviceType",nsADI);
    assert(spectrometerDeviceType.browseName.toString() === "3:SpectrometerDeviceType");

    const analyserChannelType    = addressSpace.findObjectType("AnalyserChannelType",nsADI);
    const accessorySlotType      = addressSpace.findObjectType("AccessorySlotType",  nsADI);
    const functionalGroupType    = addressSpace.findObjectType("FunctionalGroupType",nsADI);

    console.log("ADI namespace = ",nsADI);
    console.log("ADI namespace = ",spectrometerDeviceType.browseName.toString());

    const mySpectrometer= spectrometerDeviceType.instantiate({browseName: "MySpectrometer", organizedBy: deviceSet});
    // create a spectro meter


    function createChannel(options) {
        assert(typeof options.browseName === "string");
        assert(options.componentOf);

        const channel       = analyserChannelType.instantiate({
            browseName: options.browseName,
            componentOf: options.componentOf,
            optionals: ["ParameterSet"]
        });

        const parameterSet = channel.parameterSet;

        //var parameterSet  = topologyElementType.instantiate({ browseName: "ParameterSet", componentOf: channel });
        ///  var methodSet     = topologyElementType.instantiate({ browseName: "MethodSet",    componentOf: channel });

        addressSpace.addVariable({
            componentOf:     parameterSet,
            browseName:     "MyParameter",
            typeDefinition: "DataItemType",
            dataType: DataType.Double,
            value: new Variant({ dataType:DataType.Double, value : 10.0 })

        });

        return channel;
    }
    // add channel 1
    const channel1 = createChannel({ browseName: "Channel1", componentOf: mySpectrometer });
    const channel2 = createChannel({ browseName: "Channel2", componentOf: mySpectrometer });

    console.log(mySpectrometer.toString());

    console.log(mySpectrometer.channel1.toString());

    // var networkSet = rootFolder.networkSet;
    //var networkType = addressSpace.findObjectType("2:NetworkType");
    //var network = networkType.instantiate({ browseName: "MyNetwork", organizedBy: networkSet });

    //------------------------------------------------------------------------------
    // Add a view
    //------------------------------------------------------------------------------
    const view = addressSpace.addView({
        organizedBy: rootFolder.views,
        browseName:"MyView"
    });

    const createBoilerType = opcua.createBoilerType;
    const makeBoiler = opcua.makeBoiler;

    createBoilerType(addressSpace);
    makeBoiler(addressSpace,{
        browseName: "Boiler#1"
    });


});



function dumpNode(node) {
    function w(str,width) {
        const tmp =str+ "                                        ";
        return tmp.substr(0,width);
    }
    return   _.map(node,function(value,key) {
        return  "      " + w(key,30).green + "  : " + ((value === null)? null : value.toString());
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
    console.log(dumpNode(server.serverInfo));
    console.log("  buildInfo           :".yellow);
    console.log(dumpNode(server.engine.buildInfo));

    console.log("\n  server now waiting for connections. CTRL+C to stop".yellow);
});

server.on("create_session",function(session) {

    console.log(" SESSION CREATED");
    console.log("    client application URI: ".cyan,session.clientDescription.applicationUri);
    console.log("        client product URI: ".cyan,session.clientDescription.productUri);
    console.log("   client application name: ".cyan,session.clientDescription.applicationName.toString());
    console.log("   client application type: ".cyan,session.clientDescription.applicationType.toString());
    console.log("              session name: ".cyan,session.sessionName ? session.sessionName.toString():"<null>" );
    console.log("           session timeout: ".cyan,session.sessionTimeout);
    console.log("                session id: ".cyan,session.sessionId);
});

server.on("session_closed",function(session,reason) {
    console.log(" SESSION CLOSED :",reason);
    console.log("              session name: ".cyan,session.sessionName ? session.sessionName.toString():"<null>");
});

function w(s,w) {
    return ("000"+ s).substr(-w);
}
function t(d) {
    return w(d.getHours(),2) + ":" + w(d.getMinutes(),2) + ":" + w(d.getSeconds(),2) +":" + w(d.getMilliseconds(),3);
}

server.on("response", function (response) {
    console.log(t(response.responseHeader.timeStamp),response.responseHeader.requestHandle,
                response._schema.name.cyan," status = ",response.responseHeader.serviceResult.toString().cyan);
    switch (response._schema.name) {
        case "ModifySubscriptionResponse":
        case "CreateMonitoredItemsResponse":
        case "RepublishResponse":
        case "WriteResponse":
            //xx console.log(response.toString());
            break;
    }

});

function indent(str,nb) {
    const spacer = "                                             ".slice(0,nb);
    return str.split("\n").map(function(s) { return spacer + s; }).join("\n");
}
server.on("request", function (request,channel) {
    console.log(t(request.requestHeader.timeStamp),request.requestHeader.requestHandle,
                request._schema.name.yellow, " ID =",channel.secureChannelId.toString().cyan);
    switch (request._schema.name) {
        case "ModifySubscriptionRequest":
        case "CreateMonitoredItemsRequest":
        case "RepublishRequest":
            //xx console.log(request.toString());
            break;
        case "ReadRequest":
            break;
        case "WriteRequest":
            break;
        case "TranslateBrowsePathsToNodeIdsRequest":
            break;
    }
});

process.on("SIGINT", function() {
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

const discovery_server_endpointUrl = "opc.tcp://" + hostname + ":4840/UADiscovery";

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

