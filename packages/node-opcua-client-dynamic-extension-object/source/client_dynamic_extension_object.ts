// tslint:disable: no-console
/**
 * @module node-opcua-client-dynamic-extension-object
 */
import * as chalk from "chalk";
import * as PrettyError from "pretty-error";
const pe = new PrettyError();

import { assert } from "node-opcua-assert";
import { AttributeIds, makeNodeClassMask, makeResultMask, NodeClass, QualifiedName } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import {
    ConstructorFuncWithSchema,
    DataTypeFactory,
    FieldCategory,
    FieldInterfaceOptions,
    getBuildInType,
    StructuredTypeSchema,
    TypeDefinition,
    getStandardDataTypeFactory,
    EnumerationDefinitionSchema,
    ConstructorFunc
} from "node-opcua-factory";
import { ExpandedNodeId, makeExpandedNodeId, NodeId, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { browseAll, BrowseDescriptionLike, IBasicSession, readNamespaceArray } from "node-opcua-pseudo-session";
import {
    AnyConstructorFunc,
    createDynamicObjectConstructor,
    DataTypeAndEncodingId,
    MapDataTypeAndEncodingIdProvider,
    parseBinaryXSDAsync
} from "node-opcua-schemas";
import { BrowseDescriptionOptions, BrowseDirection, BrowseResult, ReferenceDescription } from "node-opcua-service-browse";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";
import { DataTypeDefinition, EnumDefinition, ReadValueIdOptions, StructureDefinition, StructureType } from "node-opcua-types";
import { ExtraDataTypeManager } from "./extra_data_type_manager";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);

async function _readDeprecatedFlag(session: IBasicSession, dataTypeDictionary: NodeId): Promise<boolean> {
    const browsePath = makeBrowsePath(dataTypeDictionary, ".Deprecated");
    const a = await session.translateBrowsePath(browsePath);
    /* istanbul ignore next */
    if (!a.targets || a.targets.length === 0) {
        // the server is probably version < 1.04.
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
    return dataValue.value.value || "<not set>";
}

async function _getDataTypeDescriptions(session: IBasicSession, dataTypeDictionaryNodeId: NodeId): Promise<IDataTypeDescription[]> {
    const nodeToBrowse2: BrowseDescriptionLike = {
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: false,
        nodeClassMask: makeNodeClassMask("Variable"),
        nodeId: dataTypeDictionaryNodeId,
        referenceTypeId: resolveNodeId("HasComponent"),
        // resultMask: makeResultMask("NodeId | ReferenceType | BrowseName | NodeClass | TypeDefinition")
        resultMask: makeResultMask("NodeId | BrowseName")
    };
    const result2 = await browseAll(session, nodeToBrowse2);
    result2.references = result2.references || [];
    return result2.references.map((r) => ({ nodeId: r.nodeId, browseName: r.browseName }));
}

async function _enrichWithDescriptionOf(session: IBasicSession, dataTypeDescriptions: IDataTypeDescription[]): Promise<NodeId[]> {
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
    /* istanbul ignore next */
    if (nodesToBrowse3.length === 0) {
        return [];
    }
    const results3 = await browseAll(session, nodesToBrowse3);

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
    const dataTypeNodeIds: NodeId[] = [];
    if (nodesToBrowseDataType.length > 0) {
        const results4 = await browseAll(session, nodesToBrowseDataType);
        i = 0;
        for (const result4 of results4) {
            result4.references = result4.references || [];

            /* istanbul ignore next */
            if (result4.references.length !== 1) {
                console.log("What's going on ?", result4.toString());
            }

            for (const ref of result4.references) {
                const dataTypeNodeId = ref.nodeId;

                dataTypeNodeIds.push(dataTypeNodeId);

                const dataTypeDescription = dataTypeDescriptions[i++];
                dataTypeDescription.encodings!.dataTypeNodeId = dataTypeNodeId;
            }
        }
    }
    return dataTypeNodeIds;
}

interface IDataTypeDescription {
    browseName: QualifiedName;
    nodeId: NodeId;
    encodings?: DataTypeAndEncodingId;
    symbolicName?: string;
}
async function _findEncodings(session: IBasicSession, dataTypeNodeId: NodeId): Promise<DataTypeAndEncodingId> {
    const nodeToBrowse: BrowseDescriptionLike = {
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: true,
        nodeClassMask: makeNodeClassMask("Object"),
        nodeId: dataTypeNodeId,
        referenceTypeId: resolveNodeId("HasEncoding"),
        resultMask: makeResultMask("ReferenceType | IsForward | BrowseName | NodeClass | TypeDefinition")
    };
    const result = await browseAll(session, nodeToBrowse);
    const references = result.references || [];
    if (references.length === 0) {
        // xx throw new Error("Cannot find encodings on type " + dataTypeNodeId.toString() + " statusCode " + result.statusCode.toString());
    }
    const encodings: DataTypeAndEncodingId = {
        dataTypeNodeId,

        binaryEncodingNodeId: NodeId.nullNodeId,
        jsonEncodingNodeId: NodeId.nullNodeId,
        xmlEncodingNodeId: NodeId.nullNodeId
    };
    for (const ref of references) {
        switch (ref.browseName.name) {
            case "Default Binary":
                encodings.binaryEncodingNodeId = ref.nodeId;
                break;
            case "Default XML":
                encodings.xmlEncodingNodeId = ref.nodeId;
                break;
            case "Default JSON":
                encodings.jsonEncodingNodeId = ref.nodeId;
                break;
            default:
                console.log(" ignoring encoding ", ref.browseName.toString());
        }
    }
    return encodings;
}
interface IDataTypeDefInfo {
    className: string;
    dataTypeNodeId: NodeId;
    dataTypeDefinition: StructureDefinition;
}
type DataTypeDefinitions = IDataTypeDefInfo[];

function sortStructure(dataTypeDefinitions: DataTypeDefinitions) {
    const dataTypeDefinitionsSorted: IDataTypeDefInfo[] = [];
    const _visited: { [key: string]: IDataTypeDefInfo } = {};
    const _map: { [key: string]: IDataTypeDefInfo } = {};

    for (const d of dataTypeDefinitions) {
        _map[d.dataTypeNodeId.toString()] = d;
    }

    function _visit(d: IDataTypeDefInfo) {
        const hash = d.dataTypeNodeId.toString();
        if (_visited[hash]) {
            return;
        }
        const bbb = _map[d.dataTypeDefinition.baseDataType.toString()];
        if (bbb) {
            _visit(bbb);
        }

        for (const f of d.dataTypeDefinition.fields || []) {
            const ddd = _map[f.dataType.toString()];
            if (!ddd) {
                continue;
            }
            _visit(ddd);
        }
        _visited[hash] = d;
        dataTypeDefinitionsSorted.push(d);
    }
    for (const d of dataTypeDefinitions) {
        _visit(d);
    }
    return dataTypeDefinitionsSorted;
}

async function _extractDataTypeDictionaryFromDefinition(
    session: IBasicSession,
    dataTypeDictionaryNodeId: NodeId,
    dataTypeFactory: DataTypeFactory
) {
    assert(dataTypeFactory, "expecting a dataTypeFactory");

    const dataTypeDescriptions = await _getDataTypeDescriptions(session, dataTypeDictionaryNodeId);
    const dataTypeNodeIds = await _enrichWithDescriptionOf(session, dataTypeDescriptions);

    // now read DataTypeDefinition attributes of all the dataTypeNodeIds, this will only contains concrete structure
    const nodesToRead: ReadValueIdOptions[] = dataTypeNodeIds.map((nodeId: NodeId) => ({
        attributeId: AttributeIds.DataTypeDefinition,
        nodeId
    }));

    const cache: { [key: string]: Cache } = {};
    const dataValuesWithDataTypeDefinition = nodesToRead.length > 0 ? await session.read(nodesToRead) : [];

    // in some circumstances like Euromap, this assert fails:
    // assert(dataValuesWithDataTypeDefinition.length === dataTypeDescriptions.length);

    const dataTypeDefinitions: DataTypeDefinitions = [];

    let index = 0;
    for (const dataValue of dataValuesWithDataTypeDefinition) {
        const dataTypeNodeId = dataTypeNodeIds[index];
        const dataTypeDescription = dataTypeDescriptions[index];

        /* istanbul ignore else */
        if (dataValue.statusCode === StatusCodes.Good) {
            const dataTypeDefinition = dataValue.value.value;

            if (dataTypeDefinition && dataTypeDefinition instanceof StructureDefinition) {
                const className = dataTypeDescription.browseName.name!;
                dataTypeDefinitions.push({ className, dataTypeNodeId, dataTypeDefinition });
            }
        } else {
            debugLog(
                "dataTypeNodeId ",
                dataTypeNodeId.toString(),
                " has no DataTypeDescription attribute",
                dataValue.statusCode.toString()
            );
        }
        index++;
    }
    // to do put in logical order
    const dataTypeDefinitionsSorted = sortStructure(dataTypeDefinitions);
    if (doDebug) {
        debugLog("order ", dataTypeDefinitionsSorted.map((a) => a.className + " " + a.dataTypeNodeId).join(" ->  "));
    }
    for (const { className, dataTypeNodeId, dataTypeDefinition } of dataTypeDefinitionsSorted) {
        // istanbul ignore next
        if (doDebug) {
            debugLog(chalk.yellow("--------------------------------------- "), className, dataTypeNodeId.toString());
        }
        if (dataTypeFactory.hasStructuredType(className)) {
            continue; // this structure has already been seen
        }
        // now fill typeDictionary
        try {
            const schema = await convertDataTypeDefinitionToStructureTypeSchema(
                session,
                dataTypeNodeId,
                className,
                dataTypeDefinition,
                dataTypeFactory,
                cache
            );

            // istanbul ignore next
            if (doDebug) {
                debugLog(chalk.red("Registering "), chalk.cyan(className.padEnd(30, " ")), schema.dataTypeNodeId.toString());
            }
            const Constructor = createDynamicObjectConstructor(schema, dataTypeFactory) as ConstructorFuncWithSchema;
            assert(Constructor.schema === schema);
        } catch (err) {
            console.log("Constructor verification err: ", err.message);
            console.log("For this reason class " + className + " has not been registered");
            console.log(err);
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

    return {
        getDataTypeAndEncodingId(key: string): DataTypeAndEncodingId | null {
            return map[key] || null;
        }
    };
}

interface TypeDictionaryInfo {
    reference: ReferenceDescription;
    dataTypeDictionaryNodeId: NodeId;
    isDictionaryDeprecated: boolean;
    rawSchema: string;
    dependencies: { [key: string]: string };
    targetNamespace: string;
}

async function _extractDataTypeDictionary(
    session: IBasicSession,
    d: TypeDictionaryInfo,
    dataTypeManager: ExtraDataTypeManager
): Promise<void> {
    const dataTypeDictionaryNodeId = d.reference.nodeId;

    const isDictionaryDeprecated = d.isDictionaryDeprecated; // await _readDeprecatedFlag(session, dataTypeDictionaryNodeId);
    const rawSchema = d.rawSchema; // DataValue = await session.read({ nodeId: dataTypeDictionaryNodeId, attributeId: AttributeIds.Value });

    const name = await session.read({ nodeId: dataTypeDictionaryNodeId, attributeId: AttributeIds.BrowseName });
    const namespace = await _readNamespaceUriProperty(session, dataTypeDictionaryNodeId);

    if (isDictionaryDeprecated || rawSchema.length === 0) {
        debugLog(
            "DataTypeDictionary is deprecated or BSD schema stored in dataValue is null !",
            chalk.cyan(name.value.value.toString()),
            "namespace =",
            namespace
        );
        debugLog("let's use the new way (1.04) and let's crawl all dataTypes exposed by this name space");

        // dataType definition in store directly in UADataType under the $definition property
        const dataTypeFactory2 = dataTypeManager.getDataTypeFactory(dataTypeDictionaryNodeId.namespace);
        if (!dataTypeFactory2) {
            throw new Error("cannot find dataTypeFactory for namespace " + dataTypeDictionaryNodeId.namespace);
        }
        await _extractDataTypeDictionaryFromDefinition(session, dataTypeDictionaryNodeId, dataTypeFactory2);
        return;
    } else {
        debugLog(" ----- Using old method for extracting schema => with BSD files");
        // old method ( until 1.03 )
        // one need to read the schema file store in the dataTypeDictionary node and parse it !
        /* istanbul ignore next */
        if (doDebug) {
            debugLog("---------------------------------------------");
            debugLog(rawSchema.toString());
            debugLog("---------------------------------------------");
        }
        const idProvider = await _extractNodeIds(session, dataTypeDictionaryNodeId);
        const dataTypeFactory1 = dataTypeManager.getDataTypeFactory(dataTypeDictionaryNodeId.namespace);
        await parseBinaryXSDAsync(rawSchema, idProvider, dataTypeFactory1);
    }
}

async function _exploreDataTypeDefinition(
    session: IBasicSession,
    dataTypeDictionaryTypeNode: NodeId,
    dataTypeFactory: DataTypeFactory,
    namespaces: string[]
) {
    const nodeToBrowse: BrowseDescriptionLike = {
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: false,
        nodeClassMask: makeNodeClassMask("Variable"),
        nodeId: dataTypeDictionaryTypeNode,
        referenceTypeId: resolveNodeId("HasComponent"),
        resultMask: makeResultMask("ReferenceType | IsForward | BrowseName | NodeClass | TypeDefinition")
    };
    const result = await browseAll(session, nodeToBrowse);
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
    const results2 = await browseAll(session, nodesToBrowse2);

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
        for (let i = 0; i < references.length; i++) {
            const ref = references[i];
            const binaryEncoding = binaryEncodingNodeIds[i];
            const name = ref.browseName!.name!.toString();
            if (doDebug) {
                debugLog("      type ", name.padEnd(30, " "), binaryEncoding.toString());
            }
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

const regexTargetNamespaceAttribute = /TargetNamespace="([^\"]+)"|TargetNamespace='([^\"]+)'/;
function extractTargetNamespaceAttribute(xmlElement: string): string {
    // warning TargetNamespace could have ' or " , Wago PLC for instance uses simple quotes
    const c2 = xmlElement.match(regexTargetNamespaceAttribute);
    if (c2) {
        return c2[1] || c2[2];
    }
    return "";
}
const regexNamespaceRef = /xmlns:(.*)=(("([^"]+)")|('([^']+)'))/;
function extraNamespaceRef(attribute: string): { xmlns: string; namespace: string } | null {
    const c = attribute.match(regexNamespaceRef);
    if (c) {
        const xmlns = c[1] as string;
        const namespace: string = c[3] || c[4];
        return { xmlns, namespace };
    }
    return null;
}

/**
 * Extract all custom dataType
 * @param session
 * @param dataTypeManager
 * @async
 */
export async function populateDataTypeManager(session: IBasicSession, dataTypeManager: ExtraDataTypeManager) {
    debugLog("in ... populateDataTypeManager");

    // read namespace array
    const dataValueNamespaceArray = await session.read({
        attributeId: AttributeIds.Value,
        nodeId: resolveNodeId("Server_NamespaceArray")
    });

    const namespaceArray: string[] = dataValueNamespaceArray.value.value;

    // istanbul ignore next
    if (!namespaceArray) {
        debugLog("session: cannot read Server_NamespaceArray");
        // throw new Error("Cannot get Server_NamespaceArray as a array of string");
        return;
    }

    // istanbul ignore next
    if (doDebug) {
        debugLog("namespaceArray ", namespaceArray.map((a, index) => " " + index.toString().padEnd(3) + ":" + a).join(" "));
    }

    if (dataValueNamespaceArray.statusCode === StatusCodes.Good && namespaceArray && namespaceArray.length > 0) {
        dataTypeManager.setNamespaceArray(namespaceArray);

        for (let namespaceIndex = 1; namespaceIndex < namespaceArray.length; namespaceIndex++) {
            if (!dataTypeManager.hasDataTypeFactory(namespaceIndex)) {
                const dataTypeFactory1 = new DataTypeFactory([getStandardDataTypeFactory()]);
                dataTypeManager.registerDataTypeFactory(namespaceIndex, dataTypeFactory1);
            }
        }
    }

    /// to do :: may be not useful
    if (!dataValueNamespaceArray.value.value && dataTypeManager.namespaceArray.length === 0) {
        dataTypeManager.setNamespaceArray([]);
    }

    const dataTypeDictionaryType = resolveNodeId("DataTypeDictionaryType");
    // DataType/OPCBinary => i=93 [OPCBinarySchema_TypeSystem]

    // "OPC Binary"[DataSystemType]
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
    const result = await browseAll(session, nodeToBrowse);

    if (doDebug) {
        debugLog(result.statusCode.toString());
        debugLog(result.references?.map((r: any) => r.browseName?.toString()).join(" "));
    }

    // filter nodes that have the expected namespace Index
    // ( more specifically we want to filter out DataStructure from namespace 0)
    // we also want to keep only object of type DataTypeDictionaryType
    const references = result.references!.filter(
        (e: ReferenceDescription) => e.nodeId.namespace !== 0 && sameNodeId(e.typeDefinition, dataTypeDictionaryType)
    );

    debugLog(`found ${references.length} dictionary`);

    async function putInCorrectOrder(): Promise<TypeDictionaryInfo[]> {
        const infos: TypeDictionaryInfo[] = [];
        const innerMap: { [key: string]: TypeDictionaryInfo } = {};

        for (const reference of references) {
            const dataTypeDictionaryNodeId = reference.nodeId;
            const isDictionaryDeprecated = await _readDeprecatedFlag(session, dataTypeDictionaryNodeId);
            const rawSchemaDataValue = await session.read({
                attributeId: AttributeIds.Value,
                nodeId: dataTypeDictionaryNodeId
            });
            const rawSchema = rawSchemaDataValue.value.value ? rawSchemaDataValue.value.value.toString() : "";

            const info: TypeDictionaryInfo = {
                dataTypeDictionaryNodeId,
                dependencies: {},
                isDictionaryDeprecated,
                rawSchema,
                reference,
                targetNamespace: ""
            };

            infos.push(info);

            if (!isDictionaryDeprecated && rawSchema.length > 0) {
                if (doDebug) {
                    console.log("schema", rawSchema);
                }
                const matches = rawSchema.match(/<opc:TypeDictionary([^\>]+)>/);
                if (matches) {
                    // extract xml:NS="namespace" from attribute list
                    // for instance:
                    //      <opc:TypeDictionary
                    //                xmlns:opc="http://opcfoundation.org/BinarySchema/"
                    //                xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                    //                xmlns:ua="http://opcfoundation.org/UA/"
                    //                xmlns:tns="urn:SomeName:Ua:Types:GlobalTypes"
                    //                DefaultByteOrder="LittleEndian"
                    //                TargetNamespace="urn:SomeName:Ua:Types:GlobalTypes">
                    const typeDictionaryElementAttributes = matches[1];

                    info.targetNamespace = extractTargetNamespaceAttribute(typeDictionaryElementAttributes);

                    const nsKeyNamespace: { [key: string]: string } = {};
                    for (const attribute of typeDictionaryElementAttributes.split(" ")) {
                        const r = extraNamespaceRef(attribute);
                        if (r) {
                            const { xmlns, namespace } = r;
                            nsKeyNamespace[xmlns] = namespace;
                            debugLog("xxxx ns= ", xmlns, "=>", namespace);
                        }
                    }
                    info.dependencies = nsKeyNamespace;
                    debugLog("xxx targetNamespace = ", info.targetNamespace);
                    innerMap[info.targetNamespace] = info;
                }
            } else {
                // may be 1.04 => the rawSchema is no more needed in new version
                info.targetNamespace = namespaceArray[dataTypeDictionaryNodeId.namespace];
                debugLog("xxx targetNamespace = ", info.targetNamespace);
                innerMap[info.targetNamespace] = info;
            }
            // assert(info.targetNamespace.length !== 0);
        }
        // ----------------------------------
        const orderedList: TypeDictionaryInfo[] = [];
        const visited: any = {};
        function explore(d: TypeDictionaryInfo): void {
            if (visited[d.targetNamespace]) {
                return;
            }
            visited[d.targetNamespace] = 1;
            for (const [xmlns, namespace] of Object.entries(d.dependencies)) {
                if (!innerMap[namespace] || namespace === d.targetNamespace) {
                    continue;
                }
                explore(innerMap[namespace]);
            }
            orderedList.push(d);
        }
        for (const d of infos) {
            explore(d);
        }

        debugLog(" Ordered List = ", orderedList.map((a) => a.targetNamespace).join("  "));

        return orderedList;
    }
    const dataTypeDictionaryInfo = await putInCorrectOrder();

    // setup dependencies
    const map: { [key: string]: TypeDictionaryInfo } = {};
    for (const d of dataTypeDictionaryInfo) {
        map[d.targetNamespace] = d;

        debugLog(
            " fixing based dataTypeFactory dependencies for  ",
            d.targetNamespace,
            "index = ",
            d.dataTypeDictionaryNodeId.namespace
        );

        const baseDataFactories: DataTypeFactory[] = [getStandardDataTypeFactory()];
        for (const namespace of Object.values(d.dependencies)) {
            if (namespace === d.targetNamespace) {
                continue;
            }
            const baseDataFactory = map[namespace];
            if (!baseDataFactory) {
                // xx console.log("xxxxx baseDataFactory = ", namespace);
                continue;
            }
            const namespaceIndex = baseDataFactory.dataTypeDictionaryNodeId.namespace;
            if (dataTypeManager.hasDataTypeFactory(namespaceIndex)) {
                const dep = dataTypeManager.getDataTypeFactory(namespaceIndex);
                baseDataFactories.push(dep);
                debugLog(
                    "   considering , ",
                    baseDataFactory.targetNamespace,
                    "index = ",
                    baseDataFactory.dataTypeDictionaryNodeId.namespace
                );
            }
        }
        const dataTypeFactory = dataTypeManager.getDataTypeFactory(d.dataTypeDictionaryNodeId.namespace);
        if (dataTypeFactory) {
            dataTypeFactory.repairBaseDataFactories(baseDataFactories);
        }
    }
    // --------------------

    // now investigate DataTypeDescriptionType

    async function processReferenceOnDataTypeDictionaryType(d: TypeDictionaryInfo): Promise<void> {
        debugLog(chalk.cyan("processReferenceOnDataTypeDictionaryType on  "), d.targetNamespace);

        const ref = d.reference;
        const dataTypeDictionaryNodeId = d.reference.nodeId;

        await _extractDataTypeDictionary(session, d, dataTypeManager);
        /* istanbul ignore next */
        if (doDebug) {
            debugLog(
                chalk.bgWhite("                                         => "),
                ref.browseName.toString(),
                ref.nodeId.toString()
            );
        }
        const dataTypeFactory = dataTypeManager.getDataTypeFactoryForNamespace(dataTypeDictionaryNodeId.namespace);
        await _exploreDataTypeDefinition(session, dataTypeDictionaryNodeId, dataTypeFactory, dataTypeManager.namespaceArray);
    }

    // https://medium.com/swlh/dealing-with-multiple-promises-in-javascript-41d6c21f20ff
    for (const d of dataTypeDictionaryInfo) {
        try {
            await processReferenceOnDataTypeDictionaryType(d).catch((e) => {
                console.log(e);
                debugLog("processReferenceOnDataTypeDictionaryType has failed ");
                debugLog("Error", e.message);
                debugLog(e);
                return e;
            });
        } catch (err) {
            debugLog(chalk.red("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx "), err);
        }
    }
    debugLog("out ... populateDataTypeManager");
}

async function getHasEncodingDefaultBinary(session: IBasicSession, dataTypeNodeId: NodeId): Promise<NodeId> {
    const nodeToBrowse1: BrowseDescriptionLike = {
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: false,
        nodeClassMask: makeNodeClassMask("Object"),
        nodeId: dataTypeNodeId,
        referenceTypeId: resolveNodeId("HasEncoding"),
        resultMask: makeResultMask("NodeId | ReferenceType | BrowseName | NodeClass | TypeDefinition")
    };

    const result1 = await browseAll(session, nodeToBrowse1);

    if (result1.references && result1.references.length > 1) {
        // we have more than one possible Encoding .... only keep "Default Binary"
        result1.references = result1.references.filter((r: ReferenceDescription) => r.browseName.toString() === "Default Binary");
    }

    /* istanbul ignore next */
    if (!(result1.references && result1.references.length === 1)) {
        // may be dataTypeNodeId is not a dataType,
        // let's verify this.
        const nodeClass = await session.read({
            attributeId: AttributeIds.NodeClass,
            nodeId: dataTypeNodeId
        });
        const browseName = await session.read({
            attributeId: AttributeIds.BrowseName,
            nodeId: dataTypeNodeId
        });

        // tslint:disable:no-console
        console.log("node-id    :", dataTypeNodeId ? dataTypeNodeId.toString() : null);
        console.log("nodeClass  :", NodeClass[nodeClass.value.value]);
        console.log("browseName :", browseName.toString());
        console.log(result1.toString());
        throw new Error(
            "getDataTypeDefinition invalid HasEncoding reference dataTypeNodeId must be NodeClass.DataType but was " +
                NodeClass[nodeClass.value.value]
        );
    }

    const encodingReference = result1.references![0]!;
    assert(encodingReference.browseName.toString() === "Default Binary");

    /* istanbul ignore next */
    if (doDebug) {
        const browseName = await session.read({
            attributeId: AttributeIds.BrowseName,
            nodeId: dataTypeNodeId
        });
        debugLog(
            browseName.value.value.toString(),
            "Has Encoding ",
            encodingReference.browseName.toString(),
            encodingReference.nodeId.toString()
        );
    }
    return encodingReference.nodeId;
}

async function getDefinition(session: IBasicSession, defaultBinaryEncodingNodeId: NodeId): Promise<NodeId> {
    const nodeToBrowse2: BrowseDescriptionLike = {
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: false,
        nodeClassMask: makeNodeClassMask("Variable"),
        nodeId: defaultBinaryEncodingNodeId,
        referenceTypeId: resolveNodeId("HasDescription"),
        resultMask: makeResultMask("NodeId | ReferenceType | BrowseName | NodeClass | TypeDefinition")
    };
    const result2 = await browseAll(session, nodeToBrowse2);
    assert(result2.references && result2.references.length === 1);
    const definitionRef = result2.references![0]!;

    const nameDataValue = await session.read({
        attributeId: AttributeIds.Value,
        nodeId: definitionRef.nodeId
    });
    if (nameDataValue.statusCode !== StatusCodes.Good) {
        throw new Error("Cannot find ...  " + definitionRef.nodeId.toString());
    }
    /*
    const name = nameDataValue.value.value as string;
    if (!name) {
        console.log(nameDataValue.toString());
        throw new Error("Cannot find ...  " + name + " " + definitionRef.nodeId.toString());
    }
    */
    return definitionRef.nodeId;
}

async function getSchemaNode(session: IBasicSession, definitionRefNodeId: NodeId) {
    // find parent node to access the xsd File
    const nodeToBrowse3: BrowseDescriptionLike = {
        browseDirection: BrowseDirection.Inverse,
        includeSubtypes: false,
        nodeClassMask: makeNodeClassMask("Variable"),
        nodeId: definitionRefNodeId,
        referenceTypeId: resolveNodeId("HasComponent"),
        resultMask: makeResultMask("NodeId | ReferenceType | BrowseName | NodeClass | TypeDefinition")
    };
    const result3 = await browseAll(session, nodeToBrowse3);
    assert(result3.references && result3.references.length === 1);
    const schemaNode = result3.references![0]!.nodeId;
    return schemaNode;
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

    const defaultBinaryEncodingNodeId = await getHasEncodingDefaultBinary(session, dataTypeNodeId);

    const definitionRefNodeId = await getDefinition(session, defaultBinaryEncodingNodeId);

    const schemaNode = await getSchemaNode(session, definitionRefNodeId);

    const dataTypeFactory = dataTypeManager.getDataTypeFactoryForNamespace(schemaNode.namespace);

    /* istanbul ignore next */
    if (!dataTypeFactory) {
        throw new Error(" cannot find typeDictionary for  " + schemaNode.toString());
    }
    const nameDataValue: DataValue = await session.read({
        attributeId: AttributeIds.BrowseName,
        nodeId: dataTypeNodeId
    });

    const name = nameDataValue.value.value.name!;
    const schema = dataTypeFactory.getStructuredTypeSchema(name);
    return schema;
}

async function findSuperType(session: IBasicSession, dataTypeNodeId: NodeId): Promise<NodeId> {
    const nodeToBrowse3: BrowseDescriptionLike = {
        browseDirection: BrowseDirection.Inverse,
        includeSubtypes: false,
        nodeClassMask: makeNodeClassMask("DataType"),
        nodeId: dataTypeNodeId,
        referenceTypeId: resolveNodeId("HasSubtype"),
        resultMask: makeResultMask("NodeId | ReferenceType | BrowseName | NodeClass")
    };
    const result3 = await browseAll(session, nodeToBrowse3);

    /* istanbul ignore next */
    if (result3.statusCode !== StatusCodes.Good) {
        throw new Error("Cannot find superType for " + dataTypeNodeId.toString());
    }
    result3.references = result3.references || [];

    /* istanbul ignore next */
    if (result3.references.length !== 1) {
        console.log(result3.toString());
        throw new Error("Invalid dataType with more than one superType " + dataTypeNodeId.toString());
    }
    return result3.references[0].nodeId;
}
async function findDataTypeCategory(
    session: IBasicSession,
    cache: { [key: string]: Cache },
    dataTypeNodeId: NodeId
): Promise<FieldCategory> {
    const subTypeNodeId = await findSuperType(session, dataTypeNodeId);
    debugLog("subTypeNodeId  of ", dataTypeNodeId.toString(), " is ", subTypeNodeId.toString());
    const key = subTypeNodeId.toString();
    if (cache[key]) {
        return cache[key].category;
    }
    let category: FieldCategory;
    if (subTypeNodeId.namespace === 0 && subTypeNodeId.value <= 29) {
        // well known node ID !
        switch (subTypeNodeId.value) {
            case 22 /* Structure */:
                category = FieldCategory.complex;
                break;
            case 29 /* Enumeration */:
                category = FieldCategory.enumeration;
                break;
            default:
                category = FieldCategory.basic;
                break;
        }
        return category;
    }
    // must drill down ...
    return await findDataTypeCategory(session, cache, subTypeNodeId);
}

async function findDataTypeBasicType(
    session: IBasicSession,
    cache: { [key: string]: Cache },
    dataTypeNodeId: NodeId
): Promise<TypeDefinition> {
    const subTypeNodeId = await findSuperType(session, dataTypeNodeId);

    debugLog("subTypeNodeId  of ", dataTypeNodeId.toString(), " is ", subTypeNodeId.toString());

    const key = subTypeNodeId.toString();
    if (cache[key]) {
        return cache[key].schema;
    }
    if (subTypeNodeId.namespace === 0 && subTypeNodeId.value < 29) {
        switch (subTypeNodeId.value) {
            case 22: /* Structure */
            case 29 /* Enumeration */:
                throw new Error("Not expecting Structure or Enumeration");
            default:
                break;
        }
        const nameDataValue: DataValue = await session.read({
            attributeId: AttributeIds.BrowseName,
            nodeId: subTypeNodeId
        });
        const name = nameDataValue.value.value.name!;
        return getBuildInType(name);
    }
    // must drill down ...
    return await findDataTypeBasicType(session, cache, subTypeNodeId);
}

interface Cache {
    fieldTypeName: string;
    schema: TypeDefinition;
    category: FieldCategory;
}

async function readBrowseName(session: IBasicSession, nodeId: NodeId): Promise<string> {
    const dataValue = await session.read({ nodeId, attributeId: AttributeIds.BrowseName });
    if (dataValue.statusCode !== StatusCodes.Good) {
        const message =
            "cannot extract BrowseName of nodeId = " + nodeId.toString() + " statusCode = " + dataValue.statusCode.toString();
        debugLog(message);
        throw new Error(message);
    }
    return dataValue.value!.value.name;
}

async function resolveFieldType(
    session: IBasicSession,
    dataTypeNodeId: NodeId,
    dataTypeFactory: DataTypeFactory,
    cache: { [key: string]: Cache }
): Promise<Cache | null> {
    if (dataTypeNodeId.namespace === 0 && dataTypeNodeId.value === 22) {
        return null;
    }
    const key = dataTypeNodeId.toString();
    const v = cache[key];
    if (v) {
        return v;
    }

    if (dataTypeNodeId.value === 0) {
        const v3: Cache = {
            category: FieldCategory.basic,
            fieldTypeName: "Variant",
            schema: dataTypeFactory.getSimpleType("Variant")
        };
        cache[key] = v3;
        return v3;
    }

    const fieldTypeName = await readBrowseName(session, dataTypeNodeId);

    let schema: TypeDefinition | undefined;
    let category: FieldCategory = FieldCategory.enumeration;

    if (dataTypeFactory.hasStructuredType(fieldTypeName!)) {
        schema = dataTypeFactory.getStructuredTypeSchema(fieldTypeName);
        category = FieldCategory.complex;
    } else if (dataTypeFactory.hasSimpleType(fieldTypeName!)) {
        category = FieldCategory.basic;
        schema = dataTypeFactory.getSimpleType(fieldTypeName!);
    } else if (dataTypeFactory.hasEnumeration(fieldTypeName!)) {
        category = FieldCategory.enumeration;
        schema = dataTypeFactory.getEnumeration(fieldTypeName!)!;
    } else {
        debugLog(" type " + fieldTypeName + " has not been seen yet, let resolve it");
        category = await findDataTypeCategory(session, cache, dataTypeNodeId);
        debugLog(" type " + fieldTypeName + " has not been seen yet, let resolve it => (category = ", category, " )");

        switch (category) {
            case FieldCategory.basic:
                schema = await findDataTypeBasicType(session, cache, dataTypeNodeId);
                /* istanbul ignore next */
                if (!schema) {
                    console.log("Cannot find basic type " + fieldTypeName);
                }
                break;
            default:
            case FieldCategory.enumeration:
            case FieldCategory.complex:
                const dataTypeDefinitionDataValue = await session.read({
                    attributeId: AttributeIds.DataTypeDefinition,
                    nodeId: dataTypeNodeId
                });

                /* istanbul ignore next */
                if (dataTypeDefinitionDataValue.statusCode !== StatusCodes.Good) {
                    throw new Error(" Cannot find dataType Definition ! with nodeId =" + dataTypeNodeId.toString());
                }
                const definition = dataTypeDefinitionDataValue.value.value;

                if (category === FieldCategory.enumeration) {
                    if (definition instanceof EnumDefinition) {
                        const e = new EnumerationDefinitionSchema({
                            enumValues: definition.fields,
                            name: fieldTypeName
                        });
                        dataTypeFactory.registerEnumeration(e);

                        schema = e;
                    }
                } else {
                    schema = await convertDataTypeDefinitionToStructureTypeSchema(
                        session,
                        dataTypeNodeId,
                        fieldTypeName,
                        definition,
                        dataTypeFactory,
                        cache
                    );
                }
                // xx const schema1 = dataTypeFactory.getStructuredTypeSchema(fieldTypeName);
                break;
        }
    }

    /* istanbul ignore next */
    if (!schema) {
        throw new Error(
            "expecting a schema here fieldTypeName=" + fieldTypeName + " " + dataTypeNodeId.toString() + " category = " + category
        );
    }

    const v2: Cache = {
        category,
        fieldTypeName,
        schema
    };
    cache[key] = v2;
    return v2;
}

async function _setupEncodings(
    session: IBasicSession,
    dataTypeNodeId: NodeId,
    schema: StructuredTypeSchema
): Promise<StructuredTypeSchema> {
    // read abstract flag
    const isAbstractDV = await session.read({ nodeId: dataTypeNodeId, attributeId: AttributeIds.IsAbstract });
    schema.dataTypeNodeId = dataTypeNodeId;
    schema.id = dataTypeNodeId;

    if (isAbstractDV.statusCode === StatusCodes.Good && isAbstractDV.value.value === false) {
        const encodings = await _findEncodings(session, dataTypeNodeId);
        schema.encodingDefaultBinary = makeExpandedNodeId(encodings.binaryEncodingNodeId);
        schema.encodingDefaultXml = makeExpandedNodeId(encodings.xmlEncodingNodeId);
        schema.encodingDefaultJson = makeExpandedNodeId(encodings.jsonEncodingNodeId);
    }
    return schema;
}

export async function convertDataTypeDefinitionToStructureTypeSchema(
    session: IBasicSession,
    dataTypeNodeId: NodeId,
    name: string,
    definition: DataTypeDefinition,
    dataTypeFactory: DataTypeFactory,
    cache: { [key: string]: Cache }
): Promise<StructuredTypeSchema> {
    if (definition instanceof StructureDefinition) {

        const fields: FieldInterfaceOptions[] = [];

        const isUnion = definition.structureType === StructureType.Union;

        switch (definition.structureType) {
            case StructureType.Union:
                // xx console.log("Union Found : ", name);
                fields.push({
                    fieldType: "UInt32",
                    name: "SwitchField"
                });
                break;
            case StructureType.Structure:
            case StructureType.StructureWithOptionalFields:
                break;
        }

        let switchValue = 1;
        let switchBit = 0;

        const bitFields: { name: string; length?: number }[] | undefined = isUnion ? undefined : [];

        for (const fieldD of definition.fields!) {
            const rt = (await resolveFieldType(session, fieldD.dataType, dataTypeFactory, cache))!;
            if (!rt) {
                console.log("convertDataTypeDefinitionToStructureTypeSchema cannot handle field", fieldD.name, "in", name);
                continue;
            }
            const { schema, category, fieldTypeName } = rt;

            const field: FieldInterfaceOptions = {
                fieldType: fieldTypeName!,
                name: fieldD.name!,
                schema
            };

            if (fieldD.isOptional) {
                field.switchBit = switchBit++;
                bitFields?.push({ name: fieldD.name! + "Specified", length: 1 });
            }
            if (isUnion) {
                field.switchValue = switchValue;
                switchValue += 1;
            }

            assert(fieldD.valueRank === -1 || fieldD.valueRank === 1 || fieldD.valueRank === 0);
            if (fieldD.valueRank === 1) {
                field.isArray = true;
            } else {
                field.isArray = false;
            }
            field.category = category;
            field.schema = schema;
            fields.push(field);
        }

        const a = await resolveFieldType(session, definition.baseDataType, dataTypeFactory, cache);
        const baseType = a ? a.fieldTypeName : "ExtensionObject";

        const os = new StructuredTypeSchema({
            baseType,
            bitFields,
            fields,
            id: 0,
            name
        });
        const structuredTypeSchema = await _setupEncodings(session, dataTypeNodeId, os);
        return structuredTypeSchema;
    }
    throw new Error("Not Implemented");
}

interface IBasicSessionEx extends IBasicSession {
    dataTypeConstructor: { [key:string]: ConstructorFunc};
    $$extraDataTypeManager?: ExtraDataTypeManager
}
export async function extractNamespaceDataType(session: IBasicSession): Promise<ExtraDataTypeManager> {

    const sessionPriv: IBasicSessionEx = session as IBasicSessionEx;
    if (!sessionPriv.$$extraDataTypeManager) {
        const dataTypeManager = new ExtraDataTypeManager();

        const namespaceArray = await readNamespaceArray(sessionPriv);
        if (namespaceArray.length === 0) {
            errorLog("namespaceArray is not populated ! check your code !")
        }
        debugLog("Namespace Array = ", namespaceArray.join("\n                   "));
        sessionPriv.$$extraDataTypeManager = dataTypeManager;
        dataTypeManager.setNamespaceArray(namespaceArray);

        for (let namespaceIndex = 1; namespaceIndex < namespaceArray.length; namespaceIndex++) {
            const dataTypeFactory1 = new DataTypeFactory([getStandardDataTypeFactory()]);
            dataTypeManager.registerDataTypeFactory(namespaceIndex, dataTypeFactory1);
        }
        await populateDataTypeManager(session, dataTypeManager);
    }
    return sessionPriv.$$extraDataTypeManager;
}

export async function getExtensionObjectConstructor(
    session: IBasicSession, 
    dataTypeNodeId: NodeId
):  Promise<AnyConstructorFunc>{
            
    if (!dataTypeNodeId) throw new Error("Invalid dataType");
    const sessionPriv = session as IBasicSessionEx;

    if (!sessionPriv.dataTypeConstructor) {
        sessionPriv.dataTypeConstructor = {};
    }
    const c = sessionPriv.dataTypeConstructor[dataTypeNodeId.toString()];
    if (c) {
        return c as AnyConstructorFunc;
    }
    await extractNamespaceDataType(session);

    if (!sessionPriv.$$extraDataTypeManager) {
        throw new Error("Make sure to call await session.extractNamespaceDataType(); ");
    }
    const extraDataTypeManager = sessionPriv.$$extraDataTypeManager as ExtraDataTypeManager;

    // make sure schema has been extracted
    const schema = await getDataTypeDefinition(session, dataTypeNodeId, extraDataTypeManager);

    // now resolve it
    const constructor = extraDataTypeManager.getExtensionObjectConstructorFromDataType(dataTypeNodeId);

    // put it in cache
    sessionPriv.dataTypeConstructor[dataTypeNodeId.toString()] = constructor;
    return constructor;
}
