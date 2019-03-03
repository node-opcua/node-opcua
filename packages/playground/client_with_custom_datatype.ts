// compile with  tsc --lib es2018 client_with_custom_datatype.ts
// tslint:disable:no-console
import chalk from "chalk";
import { assert } from "node-opcua-assert";
import {
    AttributeIds,
    BrowseDirection,
    BrowseResult,
    ConnectionStrategyOptions,
    IBasicSession,
    makeNodeClassMask,
    makeResultMask,
    MessageSecurityMode,
    NodeClass,
    NodeId,
    OPCUAClient,
    OPCUAClientOptions,
    ReferenceDescription,
    resolveNodeId,
    SecurityPolicy,
    UserTokenType,
    Variant
} from "node-opcua-client";
import { parseBinaryXSD , TypeDictionary} from "node-opcua-schemas";
import * as os from "os";
import {promisify} from "util";

const doDebug = true;
const connectionStrategy: ConnectionStrategyOptions = {
    initialDelay: 1000,
    maxRetry: 1
};
const options: OPCUAClientOptions = {
    applicationName: "ClientWithCustomDataTypeSupport",
    connectionStrategy,
    securityMode: MessageSecurityMode.None,
    // securityPolicy: SecurityPolicy.Basic256Sha256
    securityPolicy: SecurityPolicy.None
};

const client = OPCUAClient.create(options);

async function extractSchema(session: IBasicSession, nodeId: NodeId): Promise<TypeDictionary> {
    const rawSchemaDataValue = await session.read({ nodeId, attributeId: AttributeIds.Value});
    const rawSchema = rawSchemaDataValue.value.value.toString();
    if (doDebug) {
        console.log("---------------------------------------------");
        console.log(rawSchema.toString());
        console.log("---------------------------------------------");
    }
    const typeDictionary = await promisify(parseBinaryXSD)(rawSchema);
    return typeDictionary;
}



async function extractNamespaceDataType(
  session: IBasicSession,
  data: any,
  namespaceIndex: number
) {

    // DatType/OPCBinary => i=93 [OPCBinarySchema_TypeSystem]
    const opcBinaryNodeId = resolveNodeId("OPCBinarySchema_TypeSystem");

    const nodeToBrowse = {
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: false,
        nodeClassMask: makeNodeClassMask("Variable"),
        nodeId: opcBinaryNodeId,
        referenceTypeId: null,
        resultMask: makeResultMask("ReferenceType | IsForward | BrowseName | NodeClass | TypeDefinition")
    };
    const result = await session.browse(nodeToBrowse);

    // filter nodes that have the expected namespace Index
    const references = result.references!.filter(
      (e: ReferenceDescription) => e.nodeId.namespace === namespaceIndex);
    if (references.length === 0) {
        throw new Error("Cannot find TypeDefinition node for namespace " + namespaceIndex);
    }
    console.log("R = ", references[0].toString());

    const typeDictionary  = await extractSchema(session, references[0].nodeId);

    console.log(typeDictionary);
}
async function getDataTypeDefinition(session: IBasicSession, dataTypeNodeId: NodeId): Promise<void> {

    // DataType
    //    | 1
    //    | n
    //    +- HasEncoding-> "Default Binary"
    //                           |
    //                           +-- HasDescription -> "MyItemType"
    //                                                       +- ComponentOf -> Schema
    const nodeToBrowse1 = {
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: false,
        nodeClassMask: makeNodeClassMask("Object"),
        nodeId: dataTypeNodeId,
        referenceTypeId: resolveNodeId("HasEncoding"),
        resultMask: makeResultMask("NodeId | ReferenceType | BrowseName | NodeClass | TypeDefinition")
    };
    const result1 = await session.browse(nodeToBrowse1);
    assert(result1.references && result1.references.length === 1);

    const encodingReference = result1.references![0]!;
    assert(encodingReference.browseName.toString() === "Default Binary");
    console.log("Has Encoding ", encodingReference.browseName.toString(), encodingReference.nodeId.toString());

    const nodeToBrowse2 = {
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: false,
        nodeClassMask: makeNodeClassMask("Variable"),
        nodeId: encodingReference.nodeId,
        referenceTypeId: resolveNodeId("HasDescription"),
        resultMask: makeResultMask("NodeId | ReferenceType | BrowseName | NodeClass | TypeDefinition")
    };
    const result2 = await session.browse(nodeToBrowse2);
    assert(result2.references && result2.references.length === 1);
    const definitionRef = result2.references![0]!;
    console.log("HasDefinition ", definitionRef.browseName.toString(), definitionRef.nodeId.toString());

    const nameDataValue = await session.read({
        nodeId: definitionRef.nodeId,
        attributeId: AttributeIds.Value
    });
    const name = nameDataValue.value.value  as string;
    console.log("name ", name);

    // find parent node to access the xsd File
    const nodeToBrowse3 = {
        browseDirection: BrowseDirection.Inverse,
        includeSubtypes: false,
        nodeClassMask: makeNodeClassMask("Variable"),
        nodeId: definitionRef.nodeId,
        referenceTypeId: resolveNodeId("HasComponent"),
        resultMask: makeResultMask("NodeId | ReferenceType | BrowseName | NodeClass | TypeDefinition")
    };
    const result3 = await session.browse(nodeToBrowse3);
    assert(result3.references && result3.references.length === 1);
    const schemaNode = result3.references![0]!.nodeId;
    const typeDictionary  = await extractSchema(session, schemaNode);
    return (typeDictionary.structuredTypes as any)[name];
}
(async () => {
    try {

        console.log(" about to connect");
        await client.connect("opc.tcp://" + os.hostname() + ":48010");
        console.log("connected");

        client.on("backoff", () => {
            console.log("Backoff");
        });

        const session = await client.createSession();

        const variableNodeID = "ns=2;s=Demo.WorkOrder.WorkOrderVariable";

        const dataValueDataType = await session.read({ nodeId: variableNodeID, attributeId: AttributeIds.DataType });
        console.log(" DataType =", dataValueDataType.value.value.toString());
        const dataTypeNodeId = dataValueDataType.value.value as NodeId;

        await getDataTypeDefinition(session, dataTypeNodeId);

        const dataValueDataTypeBrowseName = await session.read({
            attributeId: AttributeIds.BrowseName,
            nodeId: dataValueDataType.value.value
        });
        console.log(" DataType BrowseName", dataValueDataTypeBrowseName.value.value.toString());

        const dataValue = await session.read({ nodeId: variableNodeID, attributeId: AttributeIds.Value });

        console.log(dataValue.toString());

        await extractNamespaceDataType(session, {}, dataTypeNodeId.namespace);

        await session.close();

        await client.disconnect();

        console.log("Done !");
    } catch (e) {

        console.log(chalk.red("Error !"), e);
        process.exit(-1);
    }
})();
