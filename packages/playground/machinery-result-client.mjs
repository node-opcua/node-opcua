// demoClient.mjs
import {
    OPCUAClient,
    AttributeIds,
    DataType,
    Variant,
    readNamespaceArray,
    resolveNodeId
} from "node-opcua-client";

async function main() {
    try {
        const client = OPCUAClient.create({
            endpointMustExist: false,
        });

        const endpointUrl = "opc.tcp://localhost:26543/UA/MyLittleServer";


        await client.withSessionAsync(endpointUrl, async (session) => {
            console.log("Session created!");
            await session.extractNamespaceDataType();

            // #region Find MachineryResult namespace
            const namespaceArray = await readNamespaceArray(session);
            const nsResult = namespaceArray.findIndex((ns) => ns === "http://opcfoundation.org/UA/Machinery/Result/");
            if (nsResult === -1) {
                throw new Error("Failed to find MachineryResult namespace");
            }
            // important to use resolveNodeId here to get a proper NodeId object
            const resultDataTypeNodeId = resolveNodeId(`ns=${nsResult};i=3008`);
            // #endregion

            const content1 = new Variant({
                dataType: DataType.String,
                value: "Measurement1"
            });
            const content2 = new Variant({
                dataType: DataType.Double,
                value: [1, 2, 3]
            });


            const extObj = await session.constructExtensionObject(resultDataTypeNodeId, {
                ResultContent: [
                    content1,
                    content2
                ]
            });

            const nodeId = "ns=1;s=MyDevice_ResultVariable";
            const statusCode = await session.write({
                nodeId,
                attributeId: AttributeIds.Value,
                value: {
                    value: {
                        dataType: DataType.ExtensionObject,
                        value: extObj
                    }
                }
            });
            console.log("Wrote ResultDataType ExtensionObject to server variable", statusCode.toString);
        });
        console.log("Done");

    } catch (err) {
        console.log("An error has occurred : ", err);
    }
}

main();
