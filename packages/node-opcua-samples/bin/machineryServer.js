const { OPCUAServer, nodesets } = require("node-opcua");
const chalk = require("chalk");

(async () => {

    const server = new OPCUAServer({
        nodeset_filename: [
            nodesets.standard,
            nodesets.di,
            nodesets.machinery,
            nodesets.cnc,
            nodesets.machineTool,
        ],
    });


    await server.initialize();

    const addressSpace = server.engine.addressSpace;

    const nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
    const deviceType = addressSpace.findObjectType("DeviceType", nsDI);

    const nsMachinery = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/Machinery/");

    const machineIdentificationType = addressSpace.findObjectType("MachineIdentificationType", nsMachinery);

    const namespace2 = addressSpace.registerNamespace("urn:MyNameSpaceWithType");
    const myDeviceType = namespace2.addObjectType({
        browseName: "MyDeviceType",
        subtypeOf: deviceType
    });

    const myDevice = myDeviceType.instantiate({
        browseName: "MyDevice",
        organizedBy: addressSpace.rootFolder.objects.deviceSet,
    });

    myDevice.addReference({
        nodeId: addressSpace.rootFolder.objects.machines,
        referenceType: "Organizes",
        isForward: false
    });

    const machineryIdentification = machineIdentificationType.instantiate({
        browseName: "Identification",
        // addInOf:
        optionals: [
            "Location",
            "ManufacturerUri",
            "MonthOfConstruction",
            "YearOfConstruction",
        ]
    });

    machineryIdentification.location.setValueFromSource({ dataType: "String", value: "Paris" });
    machineryIdentification.monthOfConstruction.setValueFromSource({ dataType: "UInt32", value: 10 });
    machineryIdentification.yearOfConstruction.setValueFromSource({ dataType: "UInt32", value: 2020 });

    machineryIdentification.addReference({
        nodeId: myDevice,
        referenceType: "HasAddIn",
        isForward: false
    });


    await server.start();

    const endpointUrl = server.getEndpointUrl();

    console.log(chalk.yellow("  server on port      :"), chalk.cyan(server.endpoints[0].port.toString()));
    console.log(chalk.yellow("  endpointUrl         :"), chalk.cyan(endpointUrl));
    console.log(chalk.yellow("\n  server now waiting for connections. CTRL+C to stop"));

    console.log(chalk.cyan("\nvisit https://www.sterfive.com for more advanced examples and professional support."));

    process.on("SIGINT", async () => {
        // only work on li  nux apparently
        await server.shutdown(1000);
        console.log(chalk.red.bold(" shutting down completed "));
        process.exit(-1);
    });
})();
