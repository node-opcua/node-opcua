// run  ./opcua_ijt_demo_application.exe

import {
    OPCUAClient,
    AttributeIds,
    DataType,
    Variant,
    readNamespaceArray,
    resolveNodeId,
    getExtraDataTypeManager,
    DataTypeExtractStrategy
} from "node-opcua-client";

async function main() {
    try {
        const client = OPCUAClient.create({
            endpointMustExist: false,
        });

        const endpointUrl = "opc.tcp://RAMSES:40451";

        const nodeId = "ns=1;s=TighteningSystem/ResultManagement/Results/Result";
        const nodeId2 = "ns=1;s=TighteningSystem/ResultManagement/Results/Result/ResultContent";
        const nodeId3 = "ns=1;s=TighteningSystem/ResultManagement/Results/Result/ResultMetaData";


        await client.withSessionAsync(endpointUrl, async (session) => {

            const namespaceArray = await readNamespaceArray(session);
            console.log("Namespace Array: ", namespaceArray);

            const dataTypeManager = await getExtraDataTypeManager(session, DataTypeExtractStrategy.Force104);
            //  console.log("Data Type Manager: ", dataTypeManager);

            const ResultDataTypeNodeId = resolveNodeId(`ns=6;i=3008`);
            const ResultMetaDataTypeNodeId = resolveNodeId(`ns=6;i=3007`);
            const JointResultMetaDataTypeNodeId = resolveNodeId(`ns=7;i=3020`);


            const ResultDataTypeDefinition = await session.read({
                nodeId: ResultDataTypeNodeId,
                attributeId: AttributeIds.DataTypeDefinition
            });
            console.log("Data Definition ResultDataTypeDefinition: ", ResultDataTypeDefinition.value.value.toString());

            const ResultMetaDataTypeDefinition = await session.read({
                nodeId: ResultMetaDataTypeNodeId,
                attributeId: AttributeIds.DataTypeDefinition
            });
            console.log("Data Definition ResultMetaDataTypeDefinition: ", ResultMetaDataTypeDefinition.value.value.toString());


            const JointResultMetaDataTypeDefinition = await session.read({
                nodeId: JointResultMetaDataTypeNodeId,
                attributeId: AttributeIds.DataTypeDefinition
            });
            console.log("Data Definition JointResultMetaDataTypeDefinition: ", JointResultMetaDataTypeDefinition.value.value.toString());



            const ResultDataType = dataTypeManager.getExtensionObjectConstructorFromDataType(ResultDataTypeNodeId);
            console.log("Result DataType: ", ResultDataType.schema.name);

            const resultMetaDataType = dataTypeManager.getExtensionObjectConstructorFromDataType(ResultMetaDataTypeNodeId);
            console.log("Result Meta Data Type: ", resultMetaDataType.schema);

            const jointResultMetaDataType = dataTypeManager.getExtensionObjectConstructorFromDataType(JointResultMetaDataTypeNodeId);
            console.log("JoinResult DataType: ", jointResultMetaDataType.schema);

            {
                // TighteningSystem/ResultManagement/Results/Result/ResultMetaData/ProcessingTimes
                const nodeId = "ns=1;s=TighteningSystem/ResultManagement/Results/Result/ResultMetaData/ProcessingTimes";
                const dataValue = await session.read({
                    nodeId,
                    attributeId: AttributeIds.Value
                });
                console.log("ProcessingTimes: ", dataValue.value.value);
            }
            try {
                const dataValue1 = await session.read({
                    nodeId,
                    attributeId: AttributeIds.Value
                });
                console.log("Result: ", dataValue1.value.value);
            } catch (err) {
                console.log("Error reading Result: ", err);
            }

            try {
                const dataValue2 = await session.read({
                    nodeId: nodeId2,
                    attributeId: AttributeIds.Value
                });
                console.log("ResultContent: ", dataValue2.value.value);
            } catch (err) {
                console.log("Error reading ResultContent: ", err);
            }

            try {

                const dataValue3 = await session.read({
                    nodeId: nodeId3,
                    attributeId: AttributeIds.Value
                });
                console.log("ResultMetaData: ", dataValue3.value.value);
            } catch (err) {
                console.log("Error reading ResultMetaData: ", err);
            }

        });

        console.log("Session closed!");
    } catch (err) {
        console.log("An error has occurred : ", err);
    }
}

main();

