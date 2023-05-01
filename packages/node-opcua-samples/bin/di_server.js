#!/usr/bin/env node
/* eslint-disable max-statements */
"use strict";
const path = require("path");
const os = require("os");
const chalk = require("chalk");
const {
    OPCUAServer,
    Variant,
    OPCUACertificateManager,
    DataType,
    makeApplicationUrn,
    nodesets,
    RegisterServerMethod
} = require("node-opcua");
const { makeBoiler, createBoilerType } = require("node-opcua-address-space/testHelpers");

Error.stackTraceLimit = Infinity;

const { assert } = require("node-opcua-assert");
const argv = require("yargs")
    .wrap(132)

    .string("alternateHostname")
    .describe("alternateHostname")
    .alias("a", "alternateHostname")

    .string("port")
    .describe("port")
    .alias("p", "port")

    .number("keySize")
    .describe("keySize", "certificate keySize [1024|2048|3072|4096]")
    .default("keySize", 2048)
    .alias("k", "keySize")

    .string("discoveryServerEndpointUrl")
    .describe("discoveryServerEndpointUrl", " end point of the discovery server to register to")
    .default("discoveryServerEndpointUrl", "opc.tcp://localhost:4840")
    .alias("d", "discoveryServerEndpointUrl").argv;

const port = parseInt(argv.port) || 26543;

function wn(s, w) {
    return s.toString().padStart(w, "0");
}
function t(d) {
    return wn(d.getHours(), 2) + ":" + wn(d.getMinutes(), 2) + ":" + wn(d.getSeconds(), 2) + ":" + wn(d.getMilliseconds(), 3);
}
function w(str, width) {
    return (str || "").toString().padEnd(width).substring(0, width);
}

const envPaths = require("env-paths");
const config = envPaths("NodeOPCUA-DI-Server").config;
const pkiFolder = path.join(config, "PKI");

const serverCertificateManager = new OPCUACertificateManager({
    rootFolder: pkiFolder
});

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

function buildAddressSpace(server) {
    const addressSpace = server.engine.addressSpace;
    const namespace = addressSpace.getOwnNamespace();

    const rootFolder = addressSpace.findNode("RootFolder");
    assert(rootFolder.browseName.toString() === "Root");

    const deviceSet = rootFolder.objects.deviceSet;
    assert(deviceSet.browseName.toString() === "2:DeviceSet");

    const baseObjectType = addressSpace.findObjectType("BaseObjectType");

    const nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
    const topologyElementType = addressSpace.findObjectType("TopologyElementType", nsDI);

    const nsADI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");

    const spectrometerDeviceType = addressSpace.findObjectType("SpectrometerDeviceType", nsADI);
    assert(spectrometerDeviceType.browseName.toString() === "3:SpectrometerDeviceType");

    const analyserChannelType = addressSpace.findObjectType("AnalyserChannelType", nsADI);
    const accessorySlotType = addressSpace.findObjectType("AccessorySlotType", nsADI);
    const functionalGroupType = addressSpace.findObjectType("FunctionalGroupType", nsADI);

    const checkFunctionAlarmType = addressSpace.findEventType("CheckFunctionAlarmType", nsDI);
    console.log("checkFunctionAlarmType = ", checkFunctionAlarmType.toString());

    console.log("ADI namespace = ", nsADI);
    console.log("ADI namespace = ", spectrometerDeviceType.browseName.toString());
    console.log("discoveryServerEndpointUrl  ", server.discoveryServerEndpointUrl);

    const mySpectrometer = spectrometerDeviceType.instantiate({ browseName: "MySpectrometer", organizedBy: deviceSet });

    function createChannel(options) {
        assert(typeof options.browseName === "string");
        assert(options.componentOf);

        const channel = analyserChannelType.instantiate({
            browseName: options.browseName,
            componentOf: options.componentOf,
            optionals: ["ParameterSet"]
        });

        const parameterSet = channel.parameterSet;

        //var parameterSet  = topologyElementType.instantiate({ browseName: "ParameterSet", componentOf: channel });
        ///  var methodSet     = topologyElementType.instantiate({ browseName: "MethodSet",    componentOf: channel });

        namespace.addVariable({
            componentOf: parameterSet,
            browseName: "MyParameter",
            typeDefinition: "DataItemType",
            dataType: DataType.Double,
            value: new Variant({ dataType: DataType.Double, value: 10.0 })
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
    const view = namespace.addView({
        organizedBy: rootFolder.views,
        browseName: "MyView"
    });

    createBoilerType(namespace);
    makeBoiler(addressSpace, {
        browseName: "Boiler#1"
    });
}
function dumpNode(node) {
    return Object.entries(node)
        .map((key, value) => "      " + w(key, 30) + "  : " + (value === null ? null : value.toString()))
        .join("\n");
}

(async () => {
    const server = new OPCUAServer({
        alternateHostname: argv.alternateHostname,
        port,
        resourcePath: "/UA/Server",

        serverCertificateManager,

        nodeset_filename: [nodesets.standard, nodesets.di, nodesets.adi],

        serverInfo: {
            applicationUri: makeApplicationUrn(os.hostname(), "NodeOPCUA-SimpleADIDemoServer"),
            productUri: "urn:NodeOPCUA-SimpleADIDemoServer",
            applicationName: { text: "NodeOPCUA-SimpleADIDemoServer" },
            gatewayServerUri: null,
            discoveryProfileUri: null,
            discoveryUrls: []
        },
        buildInfo: {
            buildNumber: "1234"
        },
        serverCapabilities: {
            maxSessions: 1500,
            operationLimits: {
                maxNodesPerRead: 1000,
                maxNodesPerBrowse: 2000
            }
        },
        maxConnectionsPerEndpoint: 1500,

        userManager,
        registerServerMethod: RegisterServerMethod.LDS,
        discoveryServerEndpointUrl: argv.discoveryServerEndpointUrl || "opc.tcp://" + hostname() + ":4840"
    });
    process.title = "Node OPCUA Server on port : " + port;

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

    server.on("response", function (response) {
        console.log(
            t(response.responseHeader.timestamp),
            response.responseHeader.requestHandle,
            response.schema.name,
            " status = ",
            response.responseHeader.serviceResult.toString()
        );
        switch (response.schema.name) {
            case "ModifySubscriptionResponse":
            case "CreateMonitoredItemsResponse":
            case "RepublishResponse":
            case "WriteResponse":
                //xx console.log(response.toString());
                break;
        }
    });

    server.on("request", function (request, channel) {
        console.log(
            t(request.requestHeader.timestamp),
            request.requestHeader.requestHandle,
            request.schema.name,
            " ID =",
            channel.channelId.toString()
        );
        switch (request.schema.name) {
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

    const hostname = os.hostname();

    await server.initialize();

    buildAddressSpace(server);

    console.log(chalk.yellow("  server PID          :"), process.pid);

    await server.start();

    const endpointUrl = server.getEndpointUrl();

    console.log(chalk.yellow("  server on port      :"), server.endpoints[0].port.toString());
    console.log(chalk.yellow("  endpointUrl         :"), endpointUrl);

    console.log(chalk.yellow("  serverInfo          :"));
    console.log(dumpNode(server.serverInfo));
    console.log(chalk.yellow("  buildInfo           :"));
    console.log(dumpNode(server.engine.buildInfo));

    console.log("Certificate file = ", server.certificateFile);
    console.log(chalk.yellow("\n  server now waiting for connections. CTRL+C to stop"));

    console.log(server.buildInfo.toString());

    await new Promise((resolve) => process.once("SIGINT", resolve));
    // only work on linux apparently
    console.log(chalk.red.bold(" Received server interruption from user "));
    console.log(chalk.red.bold(" shutting down ..."));
    await server.shutdown(1000);
    console.log(chalk.red.bold(" shutting down completed "));
    console.log(chalk.red.bold(" done "));
    console.log("");
    process.exit(-1);
})();
