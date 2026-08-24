import {
    AttributeIds,
    DataType,
    DataValue,
    nodesets,
    OPCUAServer,
    SessionContext,
    type UAObject,
    type UAVariable,
    Variant
} from "node-opcua";

async function main() {
    const server = new OPCUAServer({
        nodeset_filename: [nodesets.standard, "tmp.xml"]
    });
    await server.initialize();
    const addressSpace = server.engine.addressSpace;
    if (!addressSpace) {
        throw new Error("addressSpace should be initialized");
    }

    const obj = addressSpace.rootFolder.objects.getFolderElementByName("MyObject") as UAObject | null;
    if (!obj) {
        throw new Error("cannot find MyObject");
    }
    const v = obj.getPropertyByName("MyVariable") as UAVariable | null;
    if (!v) {
        throw new Error("cannot find MyVariable");
    }

    v.setValueFromSource({ dataType: DataType.Float, value: 3.14 });
    v.setValueFromSource({ dataType: DataType.Int32, value: 42 });

    const statusCode = await v.writeAttribute(SessionContext.defaultContext, {
        nodeId: v.nodeId,
        attributeId: AttributeIds.Value,
        value: new DataValue({
            value: new Variant({ dataType: DataType.Int32, value: 42 })
        })
    });
    console.log("statusCode = ", statusCode.toString());

    await server.start();
    console.log("Server is now listening ... ( press CTRL+C to stop)");
}
main();
