#!/usr/bin / env node
/* eslint-disable max-statements */
/* eslint no-process-exit: 0 */
"use strict";
const path = require("path");
const fs = require("fs");
const os = require("os");
const assert = require("assert");
const chalk = require("chalk");
const yargs = require("yargs/yargs");
const envPaths = require("env-paths");

const {
    OPCUAServer,
    OPCUACertificateManager,
    Variant,
    DataType,
    VariantArrayType,
    DataValue,
    standardUnits,
    makeApplicationUrn,
    nodesets,
    install_optional_cpu_and_memory_usage_node,
    build_address_space_for_conformance_testing,
    RegisterServerMethod,
    extractFullyQualifiedDomainName,
    makeRoles,
    WellKnownRoles
} = require("node-opcua");

Error.stackTraceLimit = Infinity;

const argv = yargs(process.argv)
    .wrap(132)

    .string("alternateHostname")
    .describe("alternateHostname")

    .number("port")
    .default("port", 26543)

    .number("maxAllowedSessionNumber")
    .describe("maxAllowedSessionNumber", "the maximum number of concurrent client session that the server will accept")
    .default("maxAllowedSessionNumber", 500)

    .number("maxAllowedSubscriptionNumber")
    .describe("maxAllowedSubscriptionNumber", "the maximum number of concurrent subscriptions")

    .boolean("silent")
    .default("silent", false)
    .describe("silent", "no trace")

    .string("alternateHostname")
    .default("alternateHostname", null)

    .number("keySize")
    .describe("keySize", "certificate keySize [1024|2048|3072|4096]")
    .default("keySize", 2048)
    .alias("k", "keySize")

    .string("applicationName")
    .describe("applicationName", "the application name")
    .default("applicationName", "NodeOPCUA-Server")

    .alias("a", "alternateHostname")
    .alias("m", "maxAllowedSessionNumber")
    .alias("n", "applicationName")
    .alias("p", "port")

    .help(true).argv;

const port = argv.port;
const maxAllowedSessionNumber = argv.maxAllowedSessionNumber;
const maxConnectionsPerEndpoint = maxAllowedSessionNumber;
const maxAllowedSubscriptionNumber = argv.maxAllowedSubscriptionNumber || 50;
OPCUAServer.MAX_SUBSCRIPTION = maxAllowedSubscriptionNumber;

async function getIpAddresses() {
    const ipAddresses = [];
    const interfaces = os.networkInterfaces();
    Object.keys(interfaces).forEach(function (interfaceName) {
        let alias = 0;

        interfaces[interfaceName].forEach(function (iface) {
            if ("IPv4" !== iface.family || iface.internal !== false) {
                // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                return;
            }
            if (alias >= 1) {
                // this single interface has multiple ipv4 addresses
                console.log(interfaceName + ":" + alias, iface.address);
                ipAddresses.push(iface.address);
            } else {
                // this interface has only one ipv4 address
                console.log(interfaceName, iface.address);
                ipAddresses.push(iface.address);
            }
            ++alias;
        });
    });
    return ipAddresses;
}

const users = [
    {
        username: "user1",
        password: "password1",
        role: makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.ConfigureAdmin])
    },
    { username: "user2", password: "password2", role: makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.Operator]) }
];

const userManager = {
    isValidUser(username, password) {
        const uIndex = users.findIndex((x) => x.username === username);
        if (uIndex < 0) {
            return false;
        }
        if (users[uIndex].password !== password) {
            return false;
        }
        return true;
    },
    getUserRoles(username) {
      const uIndex = users.findIndex((x) => x.username === username);
      if (uIndex < 0) {
          return [];
      }
      const userRole = users[uIndex].role;
      return userRole;
    }
};

const keySize = argv.keySize;

const productUri = argv.applicationName || "NodeOPCUASample-Simple-Server";

const paths = envPaths(productUri);

(async function main() {
    const fqdn = await extractFullyQualifiedDomainName();
    console.log("FQDN = ", fqdn);

    const applicationUri = makeApplicationUrn(fqdn, productUri);
    // -----------------------------------------------
    const configFolder = paths.config;
    const pkiFolder = path.join(configFolder, "PKI");
    const userPkiFolder = path.join(configFolder, "UserPKI");

    const userCertificateManager = new OPCUACertificateManager({
        automaticallyAcceptUnknownCertificate: true,
        name: "UserPKI",
        rootFolder: userPkiFolder
    });
    await userCertificateManager.initialize();

    const serverCertificateManager = new OPCUACertificateManager({
        automaticallyAcceptUnknownCertificate: true,
        name: "PKI",
        rootFolder: pkiFolder
    });

    await serverCertificateManager.initialize();

    const certificateFile = path.join(pkiFolder, `server_certificate1.pem`);
    if (!fs.existsSync(certificateFile)) {
        console.log("Creating self-signed certificate");

        await serverCertificateManager.createSelfSignedCertificate({
            applicationUri: applicationUri,
            dns: argv.alternateHostname ? [argv.alternateHostname, fqdn] : [fqdn],
            ip: await getIpAddresses(),
            outputFile: certificateFile,
            subject: "/CN=Sterfive/DC=Test",
            startDate: new Date(),
            validity: 365 * 10
        });
    }
    assert(fs.existsSync(certificateFile));
    // ------------------------------------------------------------------

    const server_options = {
        serverCertificateManager,
        certificateFile,

        userCertificateManager,

        port,

        maxAllowedSessionNumber: maxAllowedSessionNumber,
        maxConnectionsPerEndpoint: maxConnectionsPerEndpoint,

        nodeset_filename: [nodesets.standard, nodesets.di],

        serverInfo: {
            applicationName: { text: "NodeOPCUA", locale: "en" },
            applicationUri: applicationUri,
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
                maxNodesPerMethodCall: 200
            }
        },
        userManager: userManager,

        isAuditing: false,
        //xx registerServerMethod: RegisterServerMethod.HIDDEN,
        //xx registerServerMethod: RegisterServerMethod.MDNS,
        registerServerMethod: RegisterServerMethod.LDS,
        discoveryServerEndpointUrl: "opc.tcp://localhost:4840"
    };

    process.title = "Node OPCUA Server on port : " + server_options.port;
    server_options.alternateHostname = argv.alternateHostname;
    const server = new OPCUAServer(server_options);

    const hostname = require("os").hostname();

    await server.initialize();

    function post_initialize() {
        const addressSpace = server.engine.addressSpace;

        build_address_space_for_conformance_testing(addressSpace);

        install_optional_cpu_and_memory_usage_node(server);

        addressSpace.installAlarmsAndConditionsService();

        const rootFolder = addressSpace.findNode("RootFolder");
        assert(rootFolder.browseName.toString() === "Root");

        const namespace = addressSpace.getOwnNamespace();

        const myDevices = namespace.addFolder(rootFolder.objects, { browseName: "MyDevices" });

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
            value: new Variant({ dataType: DataType.Double, value: 1000.0 })
        });

        setInterval(function () {
            const fluctuation = Math.random() * 100 - 50;
            variable0.setValueFromSource(new Variant({ dataType: DataType.Double, value: 1000.0 + fluctuation }));
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
                    return new Variant({ dataType: DataType.Double, value: pump_speed });
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
                    return new Variant({ dataType: DataType.DateTime, value: new Date(Date.UTC(2016, 9, 13, 8, 40, 0)) });
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
        const external_value_with_sourceTimestamp = new DataValue({
            value: new Variant({ dataType: DataType.Double, value: 10.0 }),
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
                    const value = new Variant({ dataType: DataType.Double, value: temperature });
                    const sourceTimestamp = new Date();

                    // simulate a asynchronous behaviour
                    setTimeout(function () {
                        callback(null, new DataValue({ value: value, sourceTimestamp: sourceTimestamp }));
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
            engineeringUnitsRange: { low: 100, high: 200 },
            instrumentRange: { low: -100, high: +200 },
            engineeringUnits: standardUnits.degree_celsius,
            dataType: "Double",
            value: {
                get: function () {
                    return new Variant({ dataType: DataType.Double, value: Math.random() + 19.0 });
                }
            }
        });

        const m3x3 = namespace.addVariable({
            organizedBy: addressSpace.rootFolder.objects,
            nodeId: "s=Matrix",
            browseName: "Matrix",
            dataType: "Double",
            valueRank: 2,
            arrayDimensions: [3, 3],
            value: {
                get: function () {
                    return new Variant({
                        dataType: DataType.Double,
                        arrayType: VariantArrayType.Matrix,
                        dimensions: [3, 3],
                        value: [1, 2, 3, 4, 5, 6, 7, 8, 9]
                    });
                }
            }
        });

        const xyz = namespace.addVariable({
            organizedBy: addressSpace.rootFolder.objects,
            nodeId: "s=Position",
            browseName: "Position",
            dataType: "Double",
            valueRank: 1,
            arrayDimensions: null,
            value: {
                get: function () {
                    return new Variant({
                        dataType: DataType.Double,
                        arrayType: VariantArrayType.Array,
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
            referenceType: "Organizes",
            nodeId: node.nodeId
        });
    }

    post_initialize();

    function dumpObject(node) {
        function w(str, width) {
            return ("" + str).padEnd(width).substring(0, width);
        }
        return Object.entries(node)
            .map((key, value) => "      " + w(key, 30) + "  : " + (value === null ? null : value.toString()))
            .join("\n");
    }

    console.log(chalk.yellow("  server PID          :"), process.pid);
    console.log(chalk.yellow("  silent              :"), argv.silent);

    await server.start();

    console.log(chalk.yellow("\nregistering server to :") + server.discoveryServerEndpointUrl);

    const endpointUrl = server.getEndpointUrl();

    console.log(chalk.yellow("  server on port      :"), server.endpoints[0].port.toString());
    console.log(chalk.yellow("  endpointUrl         :"), endpointUrl);

    console.log(chalk.yellow("  serverInfo          :"));
    console.log(dumpObject(server.serverInfo));
    console.log(chalk.yellow("  buildInfo           :"));
    console.log(dumpObject(server.engine.buildInfo));

    console.log(chalk.yellow("  Certificate rejected folder "), server.serverCertificateManager.rejectedFolder);
    console.log(chalk.yellow("  Certificate trusted folder  "), server.serverCertificateManager.trustedFolder);
    console.log(chalk.yellow("  Server private key          "), server.serverCertificateManager.privateKey);
    console.log(chalk.yellow("  Server public key           "), server.certificateFile);
    console.log(chalk.yellow("  X509 User rejected folder   "), server.userCertificateManager.trustedFolder);
    console.log(chalk.yellow("  X509 User trusted folder    "), server.userCertificateManager.rejectedFolder);

    console.log(chalk.yellow("\n  server now waiting for connections. CTRL+C to stop"));

    if (argv.silent) {
        console.log(" silent");
        console.log = function () {
            /** */
        };
    }
    //  console.log = function(){};

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
        return (" " + s).padStart(w, "0");
    }
    function t(d) {
        return w(d.getHours(), 2) + ":" + w(d.getMinutes(), 2) + ":" + w(d.getSeconds(), 2) + ":" + w(d.getMilliseconds(), 3);
    }
    function indent(str, nb) {
        const spacer = "                                             ".slice(0, nb);
        return str
            .split("\n")
            .map(function (s) {
                return spacer + s;
            })
            .join("\n");
    }
    function isIn(obj, arr) {
        try {
            return arr.findIndex((a) => a === obj.constructor.name.replace(/Response|Request/, "")) >= 0;
        } catch (err) {
            return true;
        }
    }

    const servicesToTrace = ["Publish", "TransferSubscriptions", "Republish", "CreateSubscription", "CreateMonitoredItems"];
    server.on("response", function (response) {
        if (argv.silent) {
            return;
        }
        if (isIn(response, servicesToTrace)) {
            console.log(
                t(response.responseHeader.timestamp),
                response.responseHeader.requestHandle,
                response.schema.name.padEnd(30, " "),
                " status = ",
                response.responseHeader.serviceResult.toString()
            );
            console.log(response.constructor.name, response.toString());
        }
    });

    server.on("request", function (request, channel) {
        if (argv.silent) {
            return;
        }
        if (isIn(request, servicesToTrace)) {
            console.log(
                t(request.requestHeader.timestamp),
                request.requestHeader.requestHandle,
                request.schema.name.padEnd(30, " "),
                " ID =",
                channel.channelId.toString()
            );
            console.log(request.constructor.name, request.toString());
        }
    });

    process.once("SIGINT", function () {
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

    server.on("serverRegistered", () => {
        console.log("server has been registered");
    });
    server.on("serverUnregistered", () => {
        console.log("server has been unregistered");
    });
    server.on("serverRegistrationRenewed", () => {
        console.log("server registration has been renewed");
    });
    server.on("serverRegistrationPending", () => {
        console.log("server registration is still pending (is Local Discovery Server up and running ?)");
    });
    server.on("newChannel", (channel) => {
        console.log(
            chalk.bgYellow("Client connected with address = "),
            channel.remoteAddress,
            " port = ",
            channel.remotePort,
            "timeout=",
            channel.timeout
        );
    });
    server.on("closeChannel", (channel) => {
        console.log(chalk.bgCyan("Client disconnected with address = "), channel.remoteAddress, " port = ", channel.remotePort);
        if (global.gc) {
            global.gc();
        }
    });
})();
