import { OPCUAServer, nodesets, UAVariable, UAObject, DataType, SessionContext, AttributeIds, DataValue, Variant } from "node-opcua";

async function main() {

    const server = new OPCUAServer({
        nodeset_filename: [nodesets.standard, "tmp.xml"]
    });
    await server.initialize();
    const addressSpace = server.engine.addressSpace!;

    const obj = addressSpace.rootFolder.objects.getFolderElementByName("MyObject")! as UAObject;
    const v = obj.getPropertyByName("MyVariable")! as UAVariable;

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