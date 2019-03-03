/**
 * @module node-opcua-client-dynamic-extension-object
 */
import * as _ from "underscore";
import { promisify } from "util";

import { assert } from "node-opcua-assert";
import {
    AttributeIds,
    makeNodeClassMask,
    makeResultMask,
} from "node-opcua-data-model";
import {
    checkDebugFlag,
    make_debugLog
} from "node-opcua-debug";
import {
    ExpandedNodeId,
    NodeId,
    resolveNodeId,
} from "node-opcua-nodeid";
import {
    IBasicSession
} from "node-opcua-pseudo-session";
import {
    getOrCreateConstructor,
    parseBinaryXSD,
    TypeDictionary
} from "node-opcua-schemas";
import {
    BrowseDirection,
    BrowseResult,
    ReferenceDescription,
} from "node-opcua-service-browse";
import { ExtraDataTypeManager } from "./extra_data_type_manager";

const doDebug = true;
const debugLog = make_debugLog(__filename);

const extraDataTypeManager = new ExtraDataTypeManager();

async function extractSchema(session: IBasicSession, nodeId: NodeId): Promise<TypeDictionary> {
    const rawSchemaDataValue = await session.read({ nodeId, attributeId: AttributeIds.Value });
    const rawSchema = rawSchemaDataValue.value.value.toString();
    if (doDebug) {
        debugLog("---------------------------------------------");
        debugLog(rawSchema.toString());
        debugLog("---------------------------------------------");
    }
    const typeDictionary = await promisify(parseBinaryXSD)(rawSchema);
    return typeDictionary;
}

export async function exploreDataTypeDefinition(
  session: IBasicSession,
  dataTypeDictionaryTypeNode: NodeId,
  typeDictionary: TypeDictionary,
  namespaces: string[]
) {

    const nodeToBrowse = {
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: false,
        nodeClassMask: makeNodeClassMask("Variable"),
        nodeId: dataTypeDictionaryTypeNode,
        referenceTypeId: resolveNodeId("HasComponent"),
        resultMask: makeResultMask("ReferenceType | IsForward | BrowseName | NodeClass | TypeDefinition")
    };
    const result = await session.browse(nodeToBrowse);
    const references = result.references || [];
    if (references.length === 0) {
        return;
    }

    // request the Definition of each not
    const nodesToBrowse2 = references.map((ref: ReferenceDescription) => {
        return {
            browseDirection: BrowseDirection.Inverse,
            includeSubtypes: false,
            nodeClassMask: makeNodeClassMask("Object | Variable"),
            nodeId: ref.nodeId,
            referenceTypeId: resolveNodeId("HasDescription"),
            resultMask: makeResultMask("NodeId | ReferenceType | BrowseName | NodeClass | TypeDefinition")
        };
    });
    const results2 = await session.browse(nodesToBrowse2);

    const binaryEncodingNodeIds = results2.map((br: BrowseResult) => {
        const defaultBin =  br.references!.filter((r: ReferenceDescription) => r.browseName.toString() === "Default Binary");
        if (defaultBin.length < 1) {
            return ExpandedNodeId;
        }
        return ExpandedNodeId.fromNodeId(defaultBin[0].nodeId, namespaces[defaultBin[0].nodeId.namespace]);
    });

    const tuples = _.zip(references, binaryEncodingNodeIds);

    for (const [ref, defaultBinary] of tuples) {
        const name = ref.browseName!.name!.toString();
        const constructor = getOrCreateConstructor(name, typeDictionary, defaultBinary);

        if (doDebug) {
            try {
                const testObject = new constructor();
                debugLog(testObject.toString());
            } catch (err) {
                debugLog(err.message);
            }
        }
    }
}

export async function extractNamespaceDataType(
  session: IBasicSession,
  dataTypeManager: ExtraDataTypeManager
) {

    // read namespace array
    const dataValueNamespaceArray = await session.read({
        attributeId: AttributeIds.Value,
        nodeId: resolveNodeId("Server_NamespaceArray")
    });
    dataTypeManager.setNamespaceArray(dataValueNamespaceArray.value.value as string[]);

    // DatType/OPCBinary => i=93 [OPCBinarySchema_TypeSystem]
    const opcBinaryNodeId = resolveNodeId("OPCBinarySchema_TypeSystem");

    const nodeToBrowse = {
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: false,
        nodeClassMask: makeNodeClassMask("Variable"),
        nodeId: opcBinaryNodeId,
        referenceTypeId: resolveNodeId("HasComponent"),
        resultMask: makeResultMask("ReferenceType | IsForward | BrowseName | NodeClass | TypeDefinition")
    };
    const result = await session.browse(nodeToBrowse);

    // filter nodes that have the expected namespace Index
    const references = result.references!.filter(
      (e: ReferenceDescription) => e.nodeId.namespace !== 0);

    if (references.length === 0) {
        return;
    }
    for (const ref of references) {
        const typeDictionary = await extractSchema(session, ref.nodeId);
        await exploreDataTypeDefinition(session, ref.nodeId, typeDictionary, dataTypeManager.namespaceArray);
        dataTypeManager.registerTypeDictionary(ref.nodeId, typeDictionary);
    }

}

export async function getDataTypeDefinition(session: IBasicSession, dataTypeNodeId: NodeId): Promise<void> {

    // DataType
    //    | 1
    //    | n
    //    +- HasEncoding-> "Default Binary"
    //                           |
    //                           +-- HasDescription -> "MyItemType"
    //                                                       +- ComponentOf -> Schema
    //
    // Note that in 1.04 compliant server, DataType defintiion might be available
    //           in a DataTypeDefinition attributes of the DataType object
    //           However this is a brand new aspect of the specificiation and is not widely implemented
    //           it is also optional
    //           It will takes time for old opcua server to be refurbished and we may have to
    //           keep the current method to access type definition from embedded xsd.
    //
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

    // Xx console.log("Has Encoding ", encodingReference.browseName.toString(), encodingReference.nodeId.toString());

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

    // xx console.log("HasDefinition ", definitionRef.browseName.toString(), definitionRef.nodeId.toString());

    const nameDataValue = await session.read({
        attributeId: AttributeIds.Value,
        nodeId: definitionRef.nodeId
    });
    const name = nameDataValue.value.value as string;
    //  xx console.log("name ", name);

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
    const typeDictionary = await extractSchema(session, schemaNode);
    return (typeDictionary.structuredTypes as any)[name];
}
