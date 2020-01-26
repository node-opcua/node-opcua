// tslint:disable: no-console
/**
 * @module node-opcua-client-dynamic-extension-object
 */
import * as chalk from "chalk";
import * as _ from "underscore";
import { promisify } from "util";

import { assert } from "node-opcua-assert";
import {
    AttributeIds,
    makeNodeClassMask,
    makeResultMask, NodeClass, QualifiedName
} from "node-opcua-data-model";
import {
    checkDebugFlag,
    make_debugLog
} from "node-opcua-debug";
import {
    ConstructorFuncWithSchema,
    DataTypeFactory,
    FieldCategory,
    FieldType,
    getBuildInType,
    getStandartDataTypeFactory,
    getStructuredTypeSchema,
    hasBuiltInType,
    hasStructuredType,
    StructuredTypeOptions,
    StructuredTypeSchema,
} from "node-opcua-factory";
import {
    ExpandedNodeId,
    NodeId,
    resolveNodeId,
    sameNodeId
} from "node-opcua-nodeid";
import {
    BrowseDescriptionLike,
    IBasicSession,
    ReadValueIdLike
} from "node-opcua-pseudo-session";
import {
    createDynamicObjectConstructor,
    DataTypeAndEncodingId,
    MapDataTypeAndEncodingIdProvider,
    parseBinaryXSDAsync,
} from "node-opcua-schemas";
import {
    BrowseDescriptionOptions,
    BrowseDirection,
    BrowseResult,
    ReferenceDescription,
} from "node-opcua-service-browse";
import {
    makeBrowsePath
} from "node-opcua-service-translate-browse-path";
import {
    StatusCodes
} from "node-opcua-status-code";
import {
    DataTypeDefinition,
    DataTypeDescription,
    EnumDefinition,
    StructureDefinition,
} from "node-opcua-types";
import {
    ExtraDataTypeManager
} from "./extra_data_type_manager";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);

async function _readDeprecatedFlag(session: IBasicSession, dataTypeDictionary: NodeId): Promise<boolean> {

    const browsePath = makeBrowsePath(dataTypeDictionary, ".Deprecated");
    const a = await session.translateBrowsePath(browsePath);
    /* istanbul ignore next */
    if (!a.targets || a.targets.length === 0) {
        debugLog("Cannot find Deprecated property for dataTypeDictionary " + dataTypeDictionary.toString());
        return false;
    }
    const deprecatedFlagNodeId = a.targets[0].targetId;
    const dataValue = await session.read({ nodeId: deprecatedFlagNodeId, attributeId: AttributeIds.Value });
    return dataValue.value.value;
}

async function _readNamespaceUriProperty(session: IBasicSession, dataTypeDictionary: NodeId): Promise<string> {
    const a = await session.translateBrowsePath(makeBrowsePath(dataTypeDictionary, ".NamespaceUri"));
    /* istanbul ignore next */
    if (!a.targets || a.targets.length === 0) {
        return "??dataTypeDictionary doesn't expose NamespaceUri property??";
    }
    const namespaceUriProp = a.targets[0].targetId;
    const dataValue = await session.read({ nodeId: namespaceUriProp, attributeId: AttributeIds.Value });
    return dataValue.value.value;
}

async function _getDataTypeDescriptions(
    session: IBasicSession,
    dataTypeDictionaryNodeId: NodeId
): Promise<IDataTypeDescriptuon[]> {

    const nodeToBrowse2 = {
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: false,
        nodeClassMask: makeNodeClassMask("Variable"),
        nodeId: dataTypeDictionaryNodeId,
        referenceTypeId: resolveNodeId("HasComponent"),
        // resultMask: makeResultMask("NodeId | ReferenceType | BrowseName | NodeClass | TypeDefinition")
        resultMask: makeResultMask("NodeId | BrowseName")
    };
    const result2 = await session.browse(nodeToBrowse2);
    result2.references = result2.references || [];
    return result2.references.map((r) => ({ nodeId: r.nodeId, browseName: r.browseName }));
}

async function _enrichWithDescriptionOf(
    session: IBasicSession,
    dataTypeDescriptions: IDataTypeDescriptuon[]
): Promise<NodeId[]> {
    const nodesToBrowse3: BrowseDescriptionOptions[] = [];
    for (const ref of dataTypeDescriptions) {
        ref.browseName.toString();
        nodesToBrowse3.push({
            browseDirection: BrowseDirection.Inverse,
            includeSubtypes: false,
            nodeClassMask: makeNodeClassMask("Object"),
            nodeId: ref.nodeId.toString(),
            referenceTypeId: resolveNodeId("HasDescription"),
            //            resultMask: makeResultMask("NodeId | ReferenceType | BrowseName | NodeClass | TypeDefinition")
            resultMask: makeResultMask("NodeId")
        });
    }
    const results3 = await session.browse(nodesToBrowse3);

    const binaryEncodings = [];
    const nodesToBrowseDataType: BrowseDescriptionOptions[] = [];

    let i = 0;
    for (const result3 of results3) {

        const dataTypeDescription = dataTypeDescriptions[i++];

        result3.references = result3.references || [];
        assert(result3.references.length === 1);
        for (const ref of result3.references) {

            const binaryEncodingNodeId = ref.nodeId;
            dataTypeDescription.encodings = dataTypeDescription.encodings || {
                binaryEncodingNodeId: NodeId.nullNodeId,
                dataTypeNodeId: NodeId.nullNodeId,
                jsonEncodingNodeId: NodeId.nullNodeId,
                xmlEncodingNodeId: NodeId.nullNodeId
            };
            dataTypeDescription.encodings.binaryEncodingNodeId = binaryEncodingNodeId;
            binaryEncodings.push(binaryEncodingNodeId);
            nodesToBrowseDataType.push({
                browseDirection: BrowseDirection.Inverse,
                includeSubtypes: false,
                nodeClassMask: makeNodeClassMask("DataType"),
                nodeId: ref.nodeId.toString(),
                referenceTypeId: resolveNodeId("HasEncoding"),
                //            resultMask: makeResultMask("NodeId | ReferenceType | BrowseName | NodeClass | TypeDefinition")
                resultMask: makeResultMask("NodeId | BrowseName")
            });
        }
    }
    const results4 = await session.browse(nodesToBrowseDataType);
    const dataTypeNodeIds: NodeId[] = [];
    i = 0;
    for (const result4 of results4) {
        result4.references = result4.references || [];
        assert(result4.references.length === 1);
        for (const ref of result4.references) {
            const dataTypeNodeId = ref.nodeId;

            dataTypeNodeIds.push(dataTypeNodeId);

            const dataTypeDescription = dataTypeDescriptions[i++];
            dataTypeDescription.encodings!.dataTypeNodeId = dataTypeNodeId;
        }
    }
    return dataTypeNodeIds;
}

interface IDataTypeDescriptuon {
    browseName: QualifiedName;
    nodeId: NodeId;
    encodings?: DataTypeAndEncodingId;
    symbolicName?: string;
}

async function _extractDataTypeDictionaryFromDefinition(
    session: IBasicSession,
    dataTypeDictionaryNodeId: NodeId,
    dataTypeFactory: DataTypeFactory,
    dataTypeManager: ExtraDataTypeManager
) {

    console.log(chalk.bgRed("_extractDataTypeDictionaryFromDefinition"));

    const dataTypeDescriptions = await _getDataTypeDescriptions(session, dataTypeDictionaryNodeId);
    const dataTypeNodeIds = await _enrichWithDescriptionOf(session, dataTypeDescriptions);

    // now read DataTypeDefition attributes of all the dataTypeNodeIds
    const nodesToRead: ReadValueIdLike[] = dataTypeNodeIds.map((nodeId: NodeId) => ({
        attributeId: AttributeIds.DataTypeDefinition, nodeId,
    }));

    const cache: any = {};
    const dataValuesWithDataTypeDefinition = await session.read(nodesToRead);

    assert(dataValuesWithDataTypeDefinition.length === dataTypeDescriptions.length);

    let index = 0;
    for (const dataValue of dataValuesWithDataTypeDefinition) {

        const dataTypeNodeId = dataTypeNodeIds[index];
        const dataTypeDescription = dataTypeDescriptions[index];
        index++;

        /* istanbul ignore next */
        if (dataValue.statusCode !== StatusCodes.Good) {
            continue;
        }
        const dataTypeDefinition = dataValue.value.value;

        if (dataTypeDefinition && dataTypeDefinition instanceof StructureDefinition) {

            const className = dataTypeDescription.browseName.name!;

            // now fill typeDictionary
            try {
                const schema = await _convertDataTypeDefinitionToStructureTypeSchema(
                    session, className, dataTypeDefinition, dataTypeFactory, dataTypeManager, cache);
                const Constructor = createDynamicObjectConstructor(schema, dataTypeFactory) as ConstructorFuncWithSchema;
                assert(Constructor.schema === schema);
                dataTypeFactory.registerClassDefinition(dataTypeNodeId, className, Constructor);
            } catch (err) {
                console.log("YY", err.message);
            }
        }
    }
}

async function _extractNodeIds(
    session: IBasicSession,
    dataTypeDictionaryNodeId: NodeId
): Promise<MapDataTypeAndEncodingIdProvider> {

    const map: { [key: string]: DataTypeAndEncodingId } = {};

    const dataTypeDescriptions = await _getDataTypeDescriptions(session, dataTypeDictionaryNodeId);

    /* const dataTypeNodeIds =  */
    await _enrichWithDescriptionOf(session, dataTypeDescriptions);

    for (const dataTypeDescription of dataTypeDescriptions) {
        map[dataTypeDescription.browseName.name!.toString()] = dataTypeDescription.encodings!;
    }

    function f(a: DataTypeAndEncodingId) {
        return a ? (a.dataTypeNodeId.toString() + " b=" +
            a.binaryEncodingNodeId?.toString() + " x=" +
            a.xmlEncodingNodeId?.toString() + " j=" +
            a.jsonEncodingNodeId?.toString()) : " null";
    }
    return {
        getDataTypeAndEncodingId(key: string) {
            return map[key];
        }
    };
}

async function _extractDataTypeDictionary(
    session: IBasicSession,
    dataTypeDictionaryNodeId: NodeId,
    dataTypeManager: ExtraDataTypeManager
): Promise<DataTypeFactory> {

    const isDictionaryDeprecated = await _readDeprecatedFlag(session, dataTypeDictionaryNodeId);
    const rawSchemaDataValue = await session.read({ nodeId: dataTypeDictionaryNodeId, attributeId: AttributeIds.Value });

    if (isDictionaryDeprecated || !rawSchemaDataValue.value.value) {

        if (!rawSchemaDataValue.value.value) {
            const name = await session.read({ nodeId: dataTypeDictionaryNodeId, attributeId: AttributeIds.BrowseName });
            const namespace = await _readNamespaceUriProperty(session, dataTypeDictionaryNodeId);
            console.log("dictionnary is deprecated ! ", name.value.value.toString(), "namespace =", namespace);
            console.log("lets use new way (1.04) and crawl all dataType exposed in this name space");
            // dataType definition in store directily in UADataType under the $definition property

            const dataTypeFactory1 = new DataTypeFactory([getStandartDataTypeFactory()]);
            await _extractDataTypeDictionaryFromDefinition(session, dataTypeDictionaryNodeId, dataTypeFactory1, dataTypeManager);
            return dataTypeFactory1;

        }
    }
    debugLog(" ----- Using old method for extracting schema => with BSD files");
    // old method ( until 1.03 )
    // one need to read the schema file store in the dataTypeDictionary node and parse it !
    //
    if (!rawSchemaDataValue.value.value) {
        // note : this case could happen as
        //        NodeSet2.xml file from version 1.02 do not expose the schema in the value
        const name = await session.read({ nodeId: dataTypeDictionaryNodeId, attributeId: AttributeIds.BrowseName });
        const message = "cannot extract schema => " + name.value.value.toString() + " " +
            dataTypeDictionaryNodeId.toString() + " " +
            rawSchemaDataValue.value.toString();
        console.log(message);
        throw new Error(message);
    }
    const rawSchema = rawSchemaDataValue.value.value.toString();

    /* istanbul ignore next */
    if (doDebug) {
        debugLog("---------------------------------------------");
        debugLog(rawSchema.toString());
        debugLog("---------------------------------------------");
    }
    const idProvider = await _extractNodeIds(session, dataTypeDictionaryNodeId);
    const dataTypeFactory = await parseBinaryXSDAsync(rawSchema, [getStandartDataTypeFactory()], idProvider);

    return dataTypeFactory;
}

async function _exploreDataTypeDefinition(
    session: IBasicSession,
    dataTypeDictionaryTypeNode: NodeId,
    dataTypeFactory: DataTypeFactory,
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

    // follow now Default Binary <= [Has Encoding] = [DataType]

    /* istanbul ignore next */
    if (doDebug) {
        console.log(chalk.bgWhite.red("testing new constructors"));
        const tuples = _.zip(references, binaryEncodingNodeIds);
        for (const [ref, binaryEncoding] of tuples) {

            const name = ref.browseName!.name!.toString();
            debugLog("      type ", name.padEnd(30, " "), binaryEncoding.toString());

            // let's verify that constructor is operational
            try {
                const constructor = dataTypeFactory.getStructureTypeConstructor(name);
                // xx const constructor = getOrCreateConstructor(name, dataTypeFactory, defaultBinary);
                const testObject = new constructor();
                debugLog(testObject.toString());
            } catch (err) {
                debugLog("         Error cannot construct Extension Object " + name);
                debugLog("         " + err.message);
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
export async function populateDataTypeManager(
    session: IBasicSession,
    dataTypeManager: ExtraDataTypeManager
) {

    debugLog("in ... populateDataTypeManager");

    // read namespace array
    const dataValueNamespaceArray = await session.read({
        attributeId: AttributeIds.Value,
        nodeId: resolveNodeId("Server_NamespaceArray")
    });

    if (dataValueNamespaceArray.statusCode === StatusCodes.Good &&
        (dataValueNamespaceArray.value.value && dataValueNamespaceArray.value.value.length > 0)) {
        dataTypeManager.setNamespaceArray(dataValueNamespaceArray.value.value as string[]);
    }

    /// to do :: may be not useful
    if (!dataValueNamespaceArray.value.value && dataTypeManager.namespaceArray.length === 0) {
        dataTypeManager.setNamespaceArray([]);
    }

    const dataTypeDictionaryType = resolveNodeId("DataTypeDictionaryType");
    // DataType/OPCBinary => i=93 [OPCBinarySchema_TypeSystem]

    // "OPC Binary"[DataSystemType]
    const opcBinaryNodeId = resolveNodeId("OPCBinarySchema_TypeSystem");

    debugLog(opcBinaryNodeId.toString());

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

    if (doDebug) {
        debugLog(result.statusCode.toString());
        debugLog(result.references?.map((r: any) => r.browseName?.toString()).join(" "));
    }

    // filter nodes that have the expected namespace Index
    // ( more specifically we want to filter out DataStructure from namespace 0)
    // we also want to keep only object of type DataTypeDictionaryType
    const references = result.references!.filter(
        (e: ReferenceDescription) => e.nodeId.namespace !== 0 &&
            sameNodeId(e.typeDefinition, dataTypeDictionaryType));

    debugLog(`found ${references.length} dictionnary`);

    // now investigate DataTypeDescriptionType
    await (async () => {
        async function processReference2(ref: ReferenceDescription): Promise<void> {

            const dataTypeDicitionaryNodeId = ref.nodeId;
            // xx const dataTypeFactory = dataTypeManager.getDataTypeFactoryForNamespace(dataTypeDicitionaryNodeId.namespace);

            const dataTypeFactory = await _extractDataTypeDictionary(session, dataTypeDicitionaryNodeId, dataTypeManager);
            dataTypeManager.registerDataTypeFactory(dataTypeDicitionaryNodeId, dataTypeFactory);

            /* istanbul ignore next */
            if (doDebug) {
                debugLog(chalk.bgWhite("                                         => "), ref.browseName.toString(), ref.nodeId.toString());
            }
            await _exploreDataTypeDefinition(session, dataTypeDicitionaryNodeId, dataTypeFactory, dataTypeManager.namespaceArray);

        }
        const promises2: Array<Promise<void>> = [];
        for (const ref of references) {
            promises2.push(processReference2(ref));
        }
        await Promise.all(promises2);

    })();

    debugLog("out ... populateDataTypeManager");
}

async function _getTypeDictionnary(
    session: IBasicSession,
    dataTypeManager: ExtraDataTypeManager,
    dataTypeDictionaryNodeId: NodeId,
    namespaceIndex: number
): Promise<DataTypeFactory> {
    let dataTypeFactory: DataTypeFactory;
    if (dataTypeManager) {
        dataTypeFactory = dataTypeManager.getDataTypeFactoryForNamespace(namespaceIndex);
    } else {
        dataTypeFactory = await _extractDataTypeDictionary(session, dataTypeDictionaryNodeId, dataTypeManager);
    }
    return dataTypeFactory;
}

export async function getDataTypeDefinition(
    session: IBasicSession,
    dataTypeNodeId: NodeId,
    // tslint:disable-next-line: no-shadowed-variable
    dataTypeManager: ExtraDataTypeManager
): Promise<StructuredTypeSchema> {

    // DataType
    //    | 1
    //    | n
    //    +- HasEncoding-> "Default Binary" (O)[DataTypeEncodingType]
    //                           |
    //                           +-- HasDescription -> "MyItemType" (V)[DataTypeDescriptionType]
    //                                                    |
    //                                                    +- ComponentOf -> Schema(V) []
    //                                                                         |
    //                                                                         +- ComponentOf -> OPC Binary(V)[DataTypeSystemType]
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

    /* istanbul ignore next */
    if (doDebug) {
        const browseName = await session.read({
            attributeId: AttributeIds.BrowseName,
            nodeId: dataTypeNodeId
        });
        debugLog(browseName.value.value.toString(), "Has Encoding ", encodingReference.browseName.toString(), encodingReference.nodeId.toString());
    }

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

    const dataTypeFactory = await _getTypeDictionnary(session, dataTypeManager, schemaNode, schemaNode.namespace);

    /* istanbul ignore next */
    if (!dataTypeFactory) {
        throw new Error(" cannot find typeDictionary for  " + schemaNode.toString());
    }

    const schema = dataTypeFactory.getStructuredTypeSchema(name);
    return schema;
}

async function _convertDataTypeDefinitionToStructureTypeSchema(
    session: IBasicSession,
    name: string,
    definition: DataTypeDefinition,
    dataTypeFactory: DataTypeFactory,
    dataTypeManager: ExtraDataTypeManager,
    cache: any
): Promise<StructuredTypeSchema> {

    // xx console.log("xxxxxxx convertDataTypeDefinitionToStructureTypeSchema");
    async function resolveFieldType(nodeId: NodeId): Promise<string | null> {
        if (nodeId.value === 0) {
            return null;
        }
        const key = nodeId.toString();
        let e = cache[key];
        if (e) {
            return e;
        }
        const dataValue = await session.read({ nodeId, attributeId: AttributeIds.BrowseName });
        if (dataValue.statusCode !== StatusCodes.Good) {
            debugLog("cannot extract node", nodeId.toString());
            return null;
        }

        e = dataValue.value!.value.name;
        cache[key] = e;
        return e;
    }

    if (definition instanceof StructureDefinition) {

        const fields: FieldType[] = [];
        for (const fieldD of definition.fields!) {

            const fieldTypeName = await resolveFieldType(fieldD.dataType);

            const fieldSchema = dataTypeFactory.getStructuredTypeSchema(fieldD.name!);
            const field: any = {
                fieldType: fieldTypeName,
                name: fieldD.name!,
                schema: fieldSchema
            };
            if (fieldD.valueRank === 1) {
                field.isArray = true;
            }

            if (hasBuiltInType(fieldTypeName!)) {
                field.category = FieldCategory.basic;
                field.schema = getBuildInType(fieldTypeName!);
            } else if (hasStructuredType(fieldTypeName!)) {
                field.category = FieldCategory.complex;
                field.schema = getStructuredTypeSchema(fieldTypeName!);
            } else {
                field.category = FieldCategory.basic;
                // try in this
                field.schema = await getDataTypeDefinition(session, fieldD.dataType, dataTypeManager);
                if (!field.schema) {
                    // tslint:disable-next-line:no-console
                    console.log("What should I do ??", fieldTypeName, " ", hasStructuredType(fieldTypeName!));
                } else {
                    if (hasBuiltInType(fieldTypeName!)) {
                        field.category = FieldCategory.basic;
                    } else {
                        field.category = FieldCategory.complex;
                    }
                }
            }
            fields.push(field);
        }

        const a = await resolveFieldType(definition.baseDataType);
        const baseType = a || "ExtensionObject";

        const os: StructuredTypeOptions = {
            baseType,
            fields,
            id: 0,
            name,
            // xx fields: definition.fields!
        };
        return new StructuredTypeSchema(os);
    } else if (definition instanceof EnumDefinition) {
        //
    }
    throw new Error("Not Implemented");
}
