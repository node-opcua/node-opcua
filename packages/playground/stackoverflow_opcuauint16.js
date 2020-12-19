const {AttributeIds, OPCUAClient, DataType, VariantArrayType} = require("node-opcua");

const endpointUrl = "opc.tcp://localhost:48010";
(async () => {

    const client = OPCUAClient.create({ endpointMustExist: false});
    client.on("backoff",() => console.log("still trying to connec to ", endpointUrl));
    await client.withSessionAsync(endpointUrl, async (session) => { 

        const arrayOfvalues = new Uint16Array([ 2, 23, 23, 12, 24, 3, 25, 3, 26, 3, 27, 3, 28, 1, 43690, 1, 1261, 0, 0, 0, 0, 0, 0, 0, 65535, 11 ]);
        const nodeToWrite = {
            nodeId: "ns=2;s=Demo.Static.Arrays.UInt16",
            attributeId: AttributeIds.Value,
            value: { 
                value: {
                    dataType: DataType.UInt16,
                    arrayType: VariantArrayType.Array,
                    value: arrayOfvalues,
                }
            }
        }
        const statusCode = await session.write(nodeToWrite);        
        console.log("write statusCode = ",statusCode.toString());
    });
})();

