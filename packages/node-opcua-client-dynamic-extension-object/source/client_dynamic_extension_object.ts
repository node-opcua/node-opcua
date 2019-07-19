/**
 * @module node-opcua-client-dynamic-extension-object
 */
import * as _ from "underscore";
import { promisify } from "util";

import { assert } from "node-opcua-assert";
import {
    AttributeIds,
    makeNodeClassMask,
    makeResultMask, NodeClass
} from "node-opcua-data-model";
import {
    checkDebugFlag,
    make_debugLog
} from "node-opcua-debug";
import {
    StructuredTypeSchema
} from "node-opcua-factory";
import {
    ExpandedNodeId,
    NodeId,
    resolveNodeId
} from "node-opcua-nodeid";
import {
    BrowseDescriptionLike,
    IBasicSession
} from "node-opcua-pseudo-session";
import {
    getOrCreateConstructor,
    parseBinaryXSD,
    TypeDictionary
} from "node-opcua-schemas";
import {
    BrowseDescription,
    BrowseDirection,
    BrowseResult,
    ReferenceDescription
} from "node-opcua-service-browse";
import {
    StatusCodes
} from "node-opcua-status-code";
import {
    ExtraDataTypeManager
} from "./extra_data_type_manager";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);

const extraDataTypeManager = new ExtraDataTypeManager();

async function extractSchema(session: IBasicSession, nodeId: NodeId): Promise<TypeDictionary> {
    const rawSchemaDataValue = await session.read({ nodeId, attributeId: AttributeIds.Value });
    const rawSchema = rawSchemaDataValue.value.value.toString();

    /* istanbul ignore next */
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

    /* istanbul ignore next */
    if (references.length === 0) {
        return;
    }

    // request the Definition of each nodes
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
        const defaultBin = br.references!.filter((r: ReferenceDescription) => r.browseName.toString() === "Default Binary");

        /* istanbul ignore next */
        if (defaultBin.length < 1) {
            return ExpandedNodeId;
        }
        return ExpandedNodeId.fromNodeId(defaultBin[0].nodeId, namespaces[defaultBin[0].nodeId.namespace]);
    });

    const tuples = _.zip(references, binaryEncodingNodeIds);

    for (const [ref, defaultBinary] of tuples) {
        const name = ref.browseName!.name!.toString();
        const constructor = getOrCreateConstructor(name, typeDictionary, defaultBinary);

        /* istanbul ignore next */
        if (doDebug) {
            // let's verify that constructor is operational
            try {
                const testObject = new constructor();
                debugLog(testObject.toString());
            } catch (err) {
                debugLog(err.message);
            }
        }
    }
}

/**
 * Extract all custom dataType
 * @param session
 * @param dataTypeManager
 * @async
 */
export async function extractNamespaceDataType(
    session: IBasicSession,
    dataTypeManager: ExtraDataTypeManager
) {

    // read namespace array
    const dataValueNamespaceArray = await session.read({
        attributeId: AttributeIds.Value,
        nodeId: resolveNodeId("Server_NamespaceArray")
    });

    if (dataValueNamespaceArray.statusCode === StatusCodes.Good) {
        dataTypeManager.setNamespaceArray(dataValueNamespaceArray.value.value as string[]);
    }

    // DatType/OPCBinary => i=93 [OPCBinarySchema_TypeSystem]
    const opcBinaryNodeId = resolveNodeId("OPCBinarySchema_TypeSystem");

    // let find all DataType dictionary node corresponding to a given namespace
    // (have DataTypeDictionaryType)
    const nodeToBrowse: BrowseDescriptionLike = {
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: false,
        nodeClassMask: makeNodeClassMask("Variable"),
        nodeId: opcBinaryNodeId,
        referenceTypeId: resolveNodeId("HasComponent"),
        resultMask: makeResultMask("ReferenceType | IsForward | BrowseName | NodeClass | TypeDefinition")
    };
    const result = await session.browse(nodeToBrowse);

    // filter nodes that have the expected namespace Index
    // ( more specifically we want to filter out DataStructure from namespace 0)
    const references = result.references!.filter(
        (e: ReferenceDescription) => e.nodeId.namespace !== 0);

    const promises: Array<Promise<void>> = [];

    const dataTypeDictionaryType = resolveNodeId("DataTypeDictionaryType");

    async function processReference(ref: ReferenceDescription): Promise<void> {
        assert(ref.typeDefinition.toString() === dataTypeDictionaryType.toString());
        const typeDictionary = await extractSchema(session, ref.nodeId);
        await exploreDataTypeDefinition(session, ref.nodeId, typeDictionary, dataTypeManager.namespaceArray);
        dataTypeManager.registerTypeDictionary(ref.nodeId, typeDictionary);
    }

    for (const ref of references) {
        promises.push(processReference(ref));
    }

    await Promise.all(promises);
}

export async function getDataTypeDefinition(
    session: IBasicSession,
    dataTypeNodeId: NodeId,
    extraDataTypeManager: ExtraDataTypeManager
): Promise<StructuredTypeSchema> {

    // DataType
    //    | 1
    //    | n
    //    +- HasEncoding-> "Default Binary"
    //                           |
    //                           +-- HasDescription -> "MyItemType"
    //                                                       +- ComponentOf -> Schema
    //
    // Note that in 1.04 compliant server, DataType definition might be available
    //           in a DataTypeDefinition attributes of the DataType object
    //           However this is a brand new aspect of the specification and is not widely implemented
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

    if (result1.references && result1.references.length > 1) {
        // we have more than one possible Encoding .... only keep "Default Binary"
        result1.references = result1.references.filter((r: ReferenceDescription) =>
            r.browseName.toString() === "Default Binary");
    }

    /* istanbul ignore next */
    if (!(result1.references && result1.references.length === 1)) {

        const nodeClass = await session.read({
            attributeId: AttributeIds.NodeClass,
            nodeId: dataTypeNodeId
        });
        const browseName = await session.read({
            attributeId: AttributeIds.BrowseName,
            nodeId: dataTypeNodeId
        });

        // tslint:disable:no-console
        console.log("node-id    :", dataTypeNodeId.toString());
        console.log("nodeClass  :", NodeClass[nodeClass.value.value]);
        console.log("browseName :", browseName.value.value.toString());
        console.log(result1.toString());
        throw new Error("getDataTypeDefinition invalid HasEncoding reference");
    }

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

    let schema: StructuredTypeSchema;
    if (extraDataTypeManager) {
        const typeDictionary = extraDataTypeManager.getTypeDictionaryForNamespace(schemaNode.namespace);
        schema =  typeDictionary.structuredTypes[name];

    } else {

        const typeDictionary = await extractSchema(session, schemaNode);
        schema =  typeDictionary.structuredTypes[name];
    }
    // associate DataTypeId with schema if not already done
    if (schema.id.value === 0 ) {
        schema.id = dataTypeNodeId;
    }
    return schema;
}
