import { AttributeIds, BrowseDirection, makeResultMask, NodeClassMask } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { INodeId, NodeIdType, sameNodeId } from "node-opcua-nodeid";
//import { DataTypeIds } from "node-opcua-constant";
import {
    BitField,
    DataTypeFactory,
    EnumerationDefinitionSchema,
    extractAllPossibleFields,
    FieldCategory,
    FieldInterfaceOptions,
    getBuiltInType,
    IStructuredTypeSchema,
    StructuredTypeSchema,
    TypeDefinition
} from "node-opcua-factory";
import { NodeId, makeExpandedNodeId, resolveNodeId, coerceNodeId } from "node-opcua-nodeid";
import {
    browseAll,
    BrowseDescriptionLike,
    findBasicDataType,
    IBasicSessionAsync,
    IBasicSessionAsync2,
    IBasicSessionBrowseAsyncSimple,
    IBasicSessionBrowseNextAsync
} from "node-opcua-pseudo-session";
import {
    EnumDefinition,
    DataTypeDefinition,
    StructureDefinition,
    StructureType,
    StructureField,
    EnumField
} from "node-opcua-types";
import { ExtensionObject } from "node-opcua-extension-object";
import { DataTypeAndEncodingId } from "node-opcua-schemas";
//
import { DataType } from "node-opcua-variant";
import { _findEncodings } from "./private/find_encodings";

const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);
const warningLog = make_warningLog(__filename);
const doDebug = false;

export interface CacheForFieldResolution {
    fieldTypeName: string;
    schema: TypeDefinition;
    category: FieldCategory;
    allowSubType?: boolean;
    dataType?: NodeId;
}
export type ResolveReject = [
    resolve: (value: any) => void,
    reject: (err: Error) => void
];

export interface ICache {
    superType?: Map<string, NodeId>;
    fieldResolution?: Map<string, CacheForFieldResolution>;
    dataTypes?: Map<string, DataType>;
    browseNameCache?: Map<string, string>;
    hitCount?: number;

    $$resolveStuff?: Map<string, ResolveReject[]>;
}

async function memoize<T>(cache: ICache, cacheName: keyof Omit<ICache, "hitCount">, nodeId: NodeId, func: () => Promise<T>): Promise<T> {
    const key = nodeId.toString();
    if (cache[cacheName]?.has(key)) {
        cache.hitCount = cache.hitCount === undefined ? 0 : cache.hitCount + 1;
        return cache[cacheName]?.get(key)! as T;
    }
    const value = await func();
    if (!cache[cacheName]) {
        cache[cacheName] = new Map();
    }
    (cache[cacheName] as Map<string,T>).set(key, value);
    return value as T;

}
function fromCache<T>(cache: ICache, cacheName: keyof Omit<ICache, "hitCount">, nodeId: NodeId): T | null
{
    const key = nodeId.toString();
    if (cache[cacheName]?.has(key)) {
        cache.hitCount = cache.hitCount === undefined ? 0 : cache.hitCount + 1;
        return cache[cacheName]?.get(key)! as T;
    }
    return null;
}

async function findSuperType(session: IBasicSessionAsync2, dataTypeNodeId: NodeId, cache: ICache): Promise<NodeId> {

    if (dataTypeNodeId.namespace === 0 && dataTypeNodeId.value === 24) {
        // BaseDataType !
        return coerceNodeId(0);
    }
    return await memoize(cache, "superType", dataTypeNodeId, async () => {

        const nodeToBrowse3: BrowseDescriptionLike = {
            browseDirection: BrowseDirection.Inverse,
            includeSubtypes: false,
            nodeClassMask: NodeClassMask.DataType,
            nodeId: dataTypeNodeId,
            referenceTypeId: resolveNodeId("HasSubtype"),
            resultMask: makeResultMask("NodeId | ReferenceType | BrowseName | NodeClass")
        };
        const result3 = await browseAll(session, nodeToBrowse3);

        /* istanbul ignore next */
        if (result3.statusCode.isNotGood()) {
            throw new Error("Cannot find superType for " + dataTypeNodeId.toString());
        }
        result3.references = result3.references || [];

        /* istanbul ignore next */
        if (result3.references.length !== 1) {
            errorLog("Invalid dataType with more than one (or 0) superType", result3.toString());
            throw new Error(
                "Invalid dataType with more than one (or 0) superType " + dataTypeNodeId.toString() + " l=" + result3.references.length
            );
        }
        return result3.references[0].nodeId;
    });
}
async function findDataTypeCategory(
    session: IBasicSessionAsync2,
    dataTypeFactory: DataTypeFactory,
    cache: ICache,
    dataTypeNodeId: NodeId,
): Promise<FieldCategory> {
    const subTypeNodeId = await findSuperType(session, dataTypeNodeId, cache);
    doDebug && debugLog("subTypeNodeId  of ", dataTypeNodeId.toString(), " is ", subTypeNodeId.toString());

    const fieldResolution = fromCache<CacheForFieldResolution>(cache, "fieldResolution", subTypeNodeId);
    if (fieldResolution) {
        return fieldResolution.category;
    }

    let category: FieldCategory;
    const n = subTypeNodeId as INodeId;
    if (n.identifierType === NodeIdType.NUMERIC && n.namespace === 0 && n.value <= 29) {
        // well known node ID !
        switch (n.value) {
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
    return await findDataTypeCategory(session, dataTypeFactory, cache, subTypeNodeId);
}

async function findDataTypeBasicType(
    session: IBasicSessionAsync2,
    cache: ICache,
    dataTypeNodeId: NodeId
): Promise<TypeDefinition> {
    const subTypeNodeId = await findSuperType(session, dataTypeNodeId, cache);

    debugLog("subTypeNodeId  of ", dataTypeNodeId.toString(), " is ", subTypeNodeId.toString());

    const fieldResolution = fromCache<CacheForFieldResolution>(cache,"fieldResolution", subTypeNodeId);
    if (fieldResolution) { 
        return fieldResolution.schema;
    }

    const n = subTypeNodeId as INodeId;
    if (n.identifierType === NodeIdType.NUMERIC && n.namespace === 0 && n.value < 29) {
        switch (n.value) {
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
        return getBuiltInType(name);
    }
    // must drill down ...
    const td = await findDataTypeBasicType(session, cache, subTypeNodeId);
    return td;
}


async function readBrowseNameWithCache(session: IBasicSessionAsync, nodeId: NodeId, cache: ICache): Promise<string> {
    return await memoize(cache, "browseNameCache", nodeId, async () => {
        const dataValue = await session.read({ nodeId, attributeId: AttributeIds.BrowseName });
        if (dataValue.statusCode.isNotGood()) {
            const message =
                "cannot extract BrowseName of nodeId = " + nodeId.toString() + " statusCode = " + dataValue.statusCode.toString();
            debugLog(message);
            throw new Error(message);
        }
        return dataValue.value!.value.name;
    })
}

async function resolve2(
    session: IBasicSessionAsync2,
    dataTypeNodeId: NodeId,
    dataTypeFactory: DataTypeFactory,
    fieldTypeName: string,
    cache: ICache
): Promise<{ schema: TypeDefinition | undefined; category: FieldCategory }> {

    const category = await findDataTypeCategory(session, dataTypeFactory,cache, dataTypeNodeId);
    debugLog(" type " + fieldTypeName + " has not been seen yet, let resolve it => (category = ", category, " )");

    let schema: TypeDefinition | undefined = undefined;
    switch (category) {
        case FieldCategory.basic:
            schema = await findDataTypeBasicType(session, cache, dataTypeNodeId);
            /* istanbul ignore next */
            if (!schema) {
                errorLog("Cannot find basic type " + fieldTypeName);
            }
            break;
        default:
        case FieldCategory.complex:
            {
                const dataTypeDefinitionDataValue = await session.read({
                    attributeId: AttributeIds.DataTypeDefinition,
                    nodeId: dataTypeNodeId
                });

                /* istanbul ignore next */
                if (dataTypeDefinitionDataValue.statusCode.isNotGood()) {
                    throw new Error(" Cannot find dataType Definition ! with nodeId =" + dataTypeNodeId.toString());
                }
                const definition = dataTypeDefinitionDataValue.value.value;

                const convertIn64ToInteger = (a: number[]) => a[1];

                const convert = (fields: EnumField[] | null) => {
                    const retVal: Record<string, number> = {};
                    fields && fields.forEach((field: EnumField) => (retVal[field.name || ""] = convertIn64ToInteger(field.value)));
                    return retVal;
                };
                if (category === FieldCategory.enumeration) {
                    if (definition instanceof EnumDefinition) {
                        const e = new EnumerationDefinitionSchema(dataTypeNodeId, {
                            enumValues: convert(definition.fields),
                            name: fieldTypeName
                        });
                        dataTypeFactory.registerEnumeration(e);

                        schema = e;
                    }
                } else {
                    const isAbstract = false;
                    schema = await convertDataTypeDefinitionToStructureTypeSchema(
                        session,
                        dataTypeNodeId,
                        fieldTypeName,
                        definition,
                        null,
                        dataTypeFactory,
                        isAbstract,
                        cache
                    );
                }
                // xx const schema1 = dataTypeFactory.getStructuredTypeSchema(fieldTypeName);
            }
            break;
    }
    return { schema, category };
}

const isExtensionObject = async (session: IBasicSessionAsync2, dataTypeNodeId: NodeId, cache: ICache): Promise<boolean> => {
    if (dataTypeNodeId.namespace === 0 && dataTypeNodeId.value === DataType.ExtensionObject) {
        return true;
    }
    const baseDataType = await findSuperType(session, dataTypeNodeId, cache);

    const bn = baseDataType as INodeId;
    if (bn.identifierType === NodeIdType.NUMERIC) {
        if (bn.namespace === 0 && bn.value === DataType.ExtensionObject) {
            return true;
        }
        if (bn.namespace === 0 && bn.value < DataType.ExtensionObject) {
            return false;
        }
    }
    return await isExtensionObject(session, baseDataType, cache);
};

// eslint-disable-next-line max-statements
async function resolveFieldType(
    session: IBasicSessionAsync2,
    dataTypeNodeId: NodeId,
    dataTypeFactory: DataTypeFactory,
    cache: ICache
): Promise<CacheForFieldResolution | null> {


    return await memoize(cache, "fieldResolution", dataTypeNodeId, async () => {

        if (dataTypeNodeId.namespace === 0 && dataTypeNodeId.value === 22) {
            // ERN   return null;
            const category: FieldCategory = FieldCategory.complex;
            const fieldTypeName = "Structure";
            const schema = ExtensionObject.schema;
            return {
                category,
                fieldTypeName,
                schema,
                allowSubType: true,
                dataType: coerceNodeId(DataType.ExtensionObject)
            };
        }

        if (dataTypeNodeId.value === 0) {
            const v3: CacheForFieldResolution = {
                category: FieldCategory.basic,
                fieldTypeName: "Variant",
                schema: dataTypeFactory.getBuiltInType("Variant")
            };
            return v3;
        }

        const readIsAbstract = async (dataTypeNodeId: NodeId): Promise<boolean> => {
            return (await session.read({ nodeId: dataTypeNodeId, attributeId: AttributeIds.IsAbstract })).value.value
        };

        const [isAbstract, fieldTypeName] = await Promise.all([
            readIsAbstract(dataTypeNodeId),
            readBrowseNameWithCache(session, dataTypeNodeId, cache)
        ]);

        if (isAbstract) {
            const _isExtensionObject = await isExtensionObject(session, dataTypeNodeId, cache);
            debugLog(
                " dataType " + dataTypeNodeId.toString() + " " + fieldTypeName + " is abstract => extObj ?= " + _isExtensionObject
            );
            if (_isExtensionObject) {
                // we could have complex => Structure
                const v3: CacheForFieldResolution = {
                    category: FieldCategory.complex,
                    fieldTypeName: fieldTypeName,
                    schema: ExtensionObject.schema,
                    allowSubType: true,
                    dataType: dataTypeNodeId
                };
                return v3;
            } else {
                // we could have basic => Variant
                const v3: CacheForFieldResolution = {
                    category: FieldCategory.basic,
                    fieldTypeName: fieldTypeName,
                    schema: dataTypeFactory.getBuiltInType("Variant"),
                    allowSubType: true,
                    dataType: dataTypeNodeId
                };
                return v3;
            }
        }

        let schema: TypeDefinition | undefined;
        let category: FieldCategory = FieldCategory.enumeration;

        if (dataTypeFactory.hasStructureByTypeName(fieldTypeName!)) {
            schema = dataTypeFactory.getStructuredTypeSchema(fieldTypeName);
            category = FieldCategory.complex;
        } else if (dataTypeFactory.hasBuiltInType(fieldTypeName!)) {
            category = FieldCategory.basic;
            schema = dataTypeFactory.getBuiltInType(fieldTypeName!);
        } else if (dataTypeFactory.hasEnumeration(fieldTypeName!)) {
            category = FieldCategory.enumeration;
            schema = dataTypeFactory.getEnumeration(fieldTypeName!)!;
        } else {
            debugLog(" type " + fieldTypeName + " has not been seen yet, let resolve it");
            const res = await resolve2(session, dataTypeNodeId, dataTypeFactory, fieldTypeName, cache);
            schema = res.schema;
            category = res.category;
        }

        /* istanbul ignore next */
        if (!schema) {
            throw new Error(
                "expecting a schema here fieldTypeName=" + fieldTypeName + " " + dataTypeNodeId.toString() + " category = " + category
            );
        }

        const v2: CacheForFieldResolution = {
            category,
            fieldTypeName,
            schema
        };
        return v2;
    });
}

async function _setupEncodings(
    session: IBasicSessionAsync & IBasicSessionBrowseNextAsync,
    dataTypeNodeId: NodeId,
    dataTypeDescription: IDataTypeDescriptionMini | null,
    schema: IStructuredTypeSchema
): Promise<IStructuredTypeSchema> {
    // read abstract flag
    const isAbstractDV = await session.read({ nodeId: dataTypeNodeId, attributeId: AttributeIds.IsAbstract });
    schema.dataTypeNodeId = dataTypeNodeId;

    if (isAbstractDV.statusCode.isGood() && isAbstractDV.value.value === false) {
        const encodings = (dataTypeDescription && dataTypeDescription.encodings) || (await _findEncodings(session, dataTypeNodeId));
        schema.encodingDefaultBinary = makeExpandedNodeId(encodings.binaryEncodingNodeId);
        schema.encodingDefaultXml = makeExpandedNodeId(encodings.xmlEncodingNodeId);
        schema.encodingDefaultJson = makeExpandedNodeId(encodings.jsonEncodingNodeId);
    } else {
        schema.isAbstract = true;
    }
    return schema;
}

export interface IDataTypeDescriptionMini {
    encodings?: DataTypeAndEncodingId;
    isAbstract?: boolean;
}

interface SessionWithCache {
    _$$cache2?: Map<string, DataType>;
    _$$cacheHits?: number;
}
async function findBasicDataTypeEx(session: IBasicSessionBrowseAsyncSimple, dataTypeNodeId: NodeId, cache: ICache): Promise<DataType> {
    return await memoize(cache, "dataTypes", dataTypeNodeId, async () => {
        const sessionEx = session as SessionWithCache;
        if (!sessionEx._$$cache2) { sessionEx._$$cache2 = new Map(); }
        const key = dataTypeNodeId.toString();
        if (sessionEx._$$cache2.has(key)) {
            sessionEx._$$cacheHits = sessionEx._$$cacheHits == undefined ? 0 : sessionEx._$$cacheHits + 1;
            // console.log("cache hit 2", key);
            return sessionEx._$$cache2.get(key)!;
        }
        const d = await findBasicDataType(session, dataTypeNodeId);
        sessionEx._$$cache2.set(key, d);
        return d;
    });
}


async function nonReentrant<T>(cache:ICache, prefix: string, dataTypeNodeId:NodeId, func: ()=>Promise<T>):Promise<T> {
   
    const key = prefix +  dataTypeNodeId.toString();
    
    if (cache.$$resolveStuff?.has(key)) {
        doDebug  && console.log(" re-entering !" + key);
        return await new Promise<T>((resolve, reject) => {
            cache.$$resolveStuff?.get(key)!.push([resolve, reject]);
        });
    }
    cache.$$resolveStuff = cache.$$resolveStuff || new Map();
    cache.$$resolveStuff.set(key, []);

    return await new Promise<T>((_resolve, _reject) => {
        cache.$$resolveStuff!.get(key)!.push([_resolve, _reject]);

        (async () => {
            try {
                const result = await func();

                const tmp = cache.$$resolveStuff!.get(key)!;
                cache.$$resolveStuff!.delete(key);
                for (const [resolve] of tmp) {
                    resolve(result);
                }
            } catch (err) {
                const tmp = cache.$$resolveStuff!.get(key)!;
                cache.$$resolveStuff!.delete(key);
                for (const [_resolve, reject] of tmp) {
                    reject(err as Error);
                }
            }
        })();
    });
}


// eslint-disable-next-line max-statements, max-params
export async function convertDataTypeDefinitionToStructureTypeSchema(
    session: IBasicSessionAsync2,
    dataTypeNodeId: NodeId,
    name: string,
    definition: DataTypeDefinition,
    dataTypeDescription: IDataTypeDescriptionMini | null,
    dataTypeFactory: DataTypeFactory,
    isAbstract: boolean,
    cache: ICache
): Promise<IStructuredTypeSchema> {
    
    return await nonReentrant(cache, "convertDataTypeDefinitionToStructureTypeSchema", dataTypeNodeId, async () => {

        // warningLog(">> convertDataTypeDefinitionToStructureTypeSchema = ", dataTypeNodeId.toString());
        if (definition instanceof StructureDefinition) {
            let fieldCountToIgnore = 0;
            const structureInfo = dataTypeFactory.getStructureInfoForDataType(definition.baseDataType);
            const baseSchema: IStructuredTypeSchema | undefined | null = structureInfo?.schema;

            if (baseSchema) {
                const possibleFields = extractAllPossibleFields(baseSchema);
                fieldCountToIgnore += possibleFields.length;
            }
            // while (base && !(base.dataTypeNodeId.value === DataType.ExtensionObject && base.dataTypeNodeId.namespace === 0)) {
            //     fieldCountToIgnore += base..length;
            //     base = base.getBaseSchema();
            // }

            const fields: FieldInterfaceOptions[] = [];

            const isUnion = definition.structureType === StructureType.Union;

            switch (definition.structureType) {
                case StructureType.Union:
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

            const bitFields: BitField[] | undefined = isUnion ? undefined : [];

            const postActions: ((schema: IStructuredTypeSchema) => void)[] = [];

            if (definition.fields) {


                for (let i = fieldCountToIgnore; i < definition.fields.length; i++) {
                    const fieldD = definition.fields[i];
                    // we need to skip fields that have already been handled in base class
                    // promises.push((
                    await (async () => {

                        let field: FieldInterfaceOptions | undefined;
                        ({ field, switchBit, switchValue } = createField(fieldD, switchBit, bitFields, isUnion, switchValue));

                        if (fieldD.dataType.value === dataTypeNodeId.value && fieldD.dataType.namespace === dataTypeNodeId.namespace) {
                            // this is a structure with a field of the same type
                            // push an empty placeholder that we will fill later
                            const fieldTypeName = await readBrowseNameWithCache(session, dataTypeNodeId, cache);
                            (field.fieldType = fieldTypeName!), (field.category = FieldCategory.complex);
                            fields.push(field);
                            const capturedField = field;
                            postActions.push((schema: IStructuredTypeSchema) => {
                                capturedField.schema = schema;
                            });
                            return;;
                        }
                        const rt = (await resolveFieldType(session, fieldD.dataType, dataTypeFactory, cache))!;
                        if (!rt) {
                            errorLog(
                                "convertDataTypeDefinitionToStructureTypeSchema cannot handle field",
                                fieldD.name,
                                "in",
                                name,
                                "because " + fieldD.dataType.toString() + " cannot be resolved"
                            );
                            return;
                        }
                        const { schema, category, fieldTypeName, dataType, allowSubType } = rt;

                        field.fieldType = fieldTypeName!;
                        field.category = category;
                        field.schema = schema;
                        field.dataType = dataType || fieldD.dataType;
                        field.allowSubType = allowSubType || false;
                        field.basicDataType = await findBasicDataTypeEx(session, field.dataType, cache);
                        fields.push(field);
                    })();
                    // ));

                }

            }
            /// some server may provide definition.baseDataType to be i=22 (ExtensionObject)
            /// instead of 12756 Union;
            if (isUnion && sameNodeId(definition.baseDataType, coerceNodeId("i=22"))) {
                definition.baseDataType = resolveNodeId("i=1276"); // aka DataTypeIds.Union
            }

            const a = await resolveFieldType(session, definition.baseDataType, dataTypeFactory, cache);
            const baseType = a ? a.fieldTypeName : isUnion ? "Union" : "ExtensionObject";

            const os = new StructuredTypeSchema({
                baseType,
                bitFields,
                fields,
                name,
                dataTypeFactory
            });
            const structuredTypeSchema = await _setupEncodings(session, dataTypeNodeId, dataTypeDescription, os);

            postActions.forEach((action) => action(structuredTypeSchema));

            doDebug && console.log("DONE ! convertDataTypeDefinitionToStructureTypeSchema = ", dataTypeNodeId.toString());
            return structuredTypeSchema;
        }
        throw new Error("Not Implemented");
    });
    function createField(
        fieldD: StructureField,
        switchBit: number,
        bitFields: BitField[] | undefined,
        isUnion: boolean,
        switchValue: number
    ): { field: FieldInterfaceOptions; switchBit: number; switchValue: number } {
        const field: FieldInterfaceOptions = {
            fieldType: "",
            name: fieldD.name!,
            schema: undefined
        };

        if (fieldD.isOptional) {
            field.switchBit = switchBit++;
            bitFields?.push({ name: fieldD.name! + "Specified", length: 1 });
        }
        if (isUnion) {
            field.switchValue = switchValue;
            switchValue += 1;
        }

        // (fieldD.valueRank === -1 || fieldD.valueRank === 1 || fieldD.valueRank === 0);

        if (fieldD.valueRank >= 1) {
            field.valueRank = fieldD.valueRank;
            field.isArray = true;
        } else {
            field.isArray = false;
        }
        return { field, switchBit, switchValue };
    }
}
