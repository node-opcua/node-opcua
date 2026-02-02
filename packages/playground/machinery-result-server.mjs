import {
    Variant,
    DataType,
    nodesets,
    OPCUAServer

} from "node-opcua";



async function startServer() {


    const server = new OPCUAServer({
        port: 26543, // the port of the listening socket of the server
        resourcePath: "/UA/MyLittleServer", // this path will be added to the endpoint resource name
        buildInfo: {
            productName: "MySampleServer1",
            buildNumber: "7658",
            buildDate: new Date(),

        },
        nodeset_filename: [
            nodesets.standard,
            nodesets.di,
            nodesets.machineryResult
        ]
    });

    await server.initialize();


    const addressSpace = server.engine.addressSpace;
    const namespaceArray = addressSpace.getNamespaceArray();
    console.log("Namespaces in the address space:");
    namespaceArray.forEach((ns, index) => {
        console.log(`Namespace[${index}]: ${ns.namespaceUri}`);
    });

    const nsResult = namespaceArray.findIndex((ns) => ns.namespaceUri === "http://opcfoundation.org/UA/Machinery/Result/");

    if (nsResult === -1) {
        throw new Error("Failed to find MachineryResult namespace");
    }

    const resultDataType = addressSpace.findDataType("ResultDataType", nsResult);
    if (!resultDataType) {
        throw new Error("Failed to find ResultDataType data type");
    }

    const namespace = addressSpace.getOwnNamespace();

    const uaMyDevice = namespace.addObject({
        organizedBy: addressSpace.rootFolder.objects,
        browseName: "MyDevice"
    });

    const uaVariable = namespace.addVariable({
        componentOf: uaMyDevice,
        nodeId: "s=MyDevice_ResultVariable",
        browseName: "Result",
        dataType: resultDataType,
    });

    const content1 = new Variant({
        dataType: DataType.String,
        value: "Measurement1"
    });

    const threeDVectorType = addressSpace.findDataType("3DCartesianCoordinates", 0);
    if (!threeDVectorType) {
        throw new Error("Failed to find ThreeDVectorType data type");
    }
    const content2 = new Variant({
        dataType: DataType.ExtensionObject,
        value: addressSpace.constructExtensionObject(threeDVectorType, {
            x: 1.0,
            y: 2.0,
            z: 3.0
        })
    });

    const extObj = addressSpace.constructExtensionObject(resultDataType, {
        ResultMetadata: {
            IsSimulated: true,
            ProductId: "12345",
        },
        ResultContent: [
            content1,
            content2
        ]
    });
    uaVariable.setValueFromSource({ dataType: "ExtensionObject", value: extObj });

    console.log("OPC UA Server initialized");

    console.log("Setting up address space...");

    // You can add your address space setup code here

    await server.start();
    console.log("OPC UA Server is now listening ... ( press CTRL+C to stop), server.endpointUrls =", server.getEndpointUrl());
    await new Promise((resolve) => process.once("SIGINT", resolve));

    console.log("Shutting down server...");
    await server.shutdown(1000);
    console.log("OPC UA Server has been shut down");

}

startServer().then(() => {
    console.log("done!");
}).catch((err) => {
    console.error("Error starting OPC UA Server:", err);
});