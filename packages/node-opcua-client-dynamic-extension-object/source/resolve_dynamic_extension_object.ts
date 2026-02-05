import { BinaryStream } from "node-opcua-binary-stream";
import { ExtensionObject, OpaqueStructure } from "node-opcua-extension-object";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import { checkDebugFlag, make_debugLog, make_warningLog } from "node-opcua-debug";
import { IBasicSessionAsync2 } from "node-opcua-pseudo-session";
import { NodeId } from "node-opcua-nodeid";
import { ConstructorFunc, StructuredTypeField } from "node-opcua-factory";
import { BrowseDirection, NodeClassMask, ResultMask } from "node-opcua-data-model";
//
import { ExtraDataTypeManager } from "./extra_data_type_manager";
import { ICache } from "./convert_data_type_definition_to_structuretype_schema";
import { readDataTypeDefinitionAndBuildType } from "./private/populate_data_type_manager_104";

const warningLog = make_warningLog(__filename);
const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);


interface ManagerContext {
    pendingExtractions: Map<string, Promise<ConstructorFunc>>;
    cache: ICache;
}
const managerContexts = new WeakMap<ExtraDataTypeManager, ManagerContext>();

function getContext(manager: ExtraDataTypeManager): ManagerContext {
    let context = managerContexts.get(manager);
    if (!context) {
        context = {
            pendingExtractions: new Map(),
            cache: {}
        };
        managerContexts.set(manager, context);
    }
    return context;
}

async function getOrExtractConstructor(
    session: IBasicSessionAsync2,
    binaryEncodingNodeId: NodeId,
    dataTypeManager: ExtraDataTypeManager
): Promise<ConstructorFunc> {

    const dataTypeFactory = dataTypeManager.getDataTypeFactoryForNamespace(binaryEncodingNodeId.namespace);
    const Constructor = dataTypeFactory.getConstructor(binaryEncodingNodeId);

    if (Constructor) {
        return Constructor;
    }
    const { pendingExtractions, cache } = getContext(dataTypeManager);
    const key = binaryEncodingNodeId.toString();
    if (pendingExtractions.has(key)) {
        return await pendingExtractions.get(key)!;
    }

    const promise = (async () => {
        if (binaryEncodingNodeId.namespace === 0) {
            throw new Error("Internal Error");
        }
        // need to extract it
        const browseResult = await session.browse({
            nodeId: binaryEncodingNodeId,
            referenceTypeId: "HasEncoding",
            browseDirection: BrowseDirection.Inverse,
            includeSubtypes: false,
            nodeClassMask: NodeClassMask.DataType,
            resultMask: ResultMask.BrowseName
        });
        if (browseResult.statusCode.isNotGood() || browseResult.references!.length !== 1) {
            throw new Error("browse failed");
        }
        const r = browseResult.references![0];
        const dataTypeNodeId = r.nodeId;

        if (dataTypeFactory.getStructureInfoForDataType(dataTypeNodeId)) {
            // it seems it has been processed already by a concurrent call
        } else {
            await readDataTypeDefinitionAndBuildType(session, dataTypeNodeId, r.browseName.name!, dataTypeManager, cache);
        }

        const structureInfo = dataTypeFactory.getStructureInfoForDataType(dataTypeNodeId)!;
        if (!structureInfo.constructor) {
            throw new Error("Cannot find constructor for abstract DataType");
        }
        return structureInfo.constructor;
    })();
    pendingExtractions.set(key, promise);
    try {
        return await promise;
    } finally {
        pendingExtractions.delete(key);
    }
}

export async function resolveOpaqueStructureInExtensionObject(
    session: IBasicSessionAsync2,
    dataTypeManager: ExtraDataTypeManager,
    object: ExtensionObject,
    visited?: Set<any>
): Promise<void> {

    visited = visited || new Set();
    if (visited.has(object)) {
        return;
    }
    visited.add(object);

    interface D {
        dataTypeManager: ExtraDataTypeManager;
        promises: Promise<void>[];
        visited: Set<any>;
    }
    async function fixOpaqueStructureOnElement(
        element: any,
        field: StructuredTypeField,
        data: D,
        args?: any
    ): Promise<unknown> {


        if (!element) {
            return element;
        }

        // Note that in some cases, we may have a Variant or an ExtensionObject which is not properly constructed 
        // (e.g. because of JSON serialization) but has the right "shape" (i.e. has the right properties).
        //  In such cases, we want to treat them as if they were properly constructed, because they might 
        // contain OpaqueStructures that need to be resolved.
        if (doDebug) {
            if (element?.constructor?.name === "Variant" && !(element instanceof Variant)) {
                debugLog("fixOpaqueStructureOnElement: Why would this happen ?");
            }
            if (element.constructor?.schema?.name === "ExtensionObject" && !(element instanceof ExtensionObject)) {
                debugLog("fixOpaqueStructureOnElement: Why would this happen ?");
            }
        }
        if (element instanceof Variant || element.constructor.name === "Variant") {

            await resolveDynamicExtensionObject(session, element, dataTypeManager, data.visited);
            return element;
        }
        if (element instanceof ExtensionObject || element?.constructor?.schema?.name === "ExtensionObject") {
            if (element instanceof OpaqueStructure) {
                const variant = new Variant({ dataType: DataType.ExtensionObject, value: element });
                await resolveDynamicExtensionObject(session, variant, dataTypeManager, data.visited);
                return variant.value as unknown;
            } else {
                await resolveOpaqueStructureInExtensionObject(session, dataTypeManager, element, data.visited);
                return element;
            }
        }
        return element;
    }
    function fixOpaqueStructure(object: any, field: StructuredTypeField, data: D, args?: any) {

        const a = object[field.name];
        if (!a) {
            return;
        }
        if (field.isArray) {
            for (let i = 0; i < a.length; i++) {
                const x = a[i];
                data.promises.push(
                    (async () => {
                        a[i] = await fixOpaqueStructureOnElement(x, field, data, args);
                    })()
                );
            }
        } else {
            data.promises.push(
                (async () => {
                    object[field.name] = await fixOpaqueStructureOnElement(a, field, data, args);
                })()
            );
        }
    }
    const promises: Promise<void>[] = [];
    object.applyOnAllFields<D>(fixOpaqueStructure, { dataTypeManager, promises, visited });
    await Promise.all(promises);
}

async function resolveDynamicExtensionObjectV(
    session: IBasicSessionAsync2,
    opaque: OpaqueStructure,
    dataTypeManager: ExtraDataTypeManager,
    visited: Set<any>
): Promise<ExtensionObject> {
    try {
        const Constructor = await getOrExtractConstructor(session, opaque.nodeId, dataTypeManager);
        const object = new Constructor();
        const stream = new BinaryStream(opaque.buffer);
        try {
            object.decode(stream);
            await resolveOpaqueStructureInExtensionObject(session, dataTypeManager, object, visited);
            return object;
        } catch (err) {
            warningLog("resolveDynamicExtensionObjectV: error decoding or resolving inner structures");
            warningLog("Constructor = ", Constructor.name);
            warningLog("opaqueStructure = ", opaque?.nodeId?.toString());
            warningLog("resolveDynamicExtensionObjectV err = ", (err as Error).message, (err as Error).stack);
            return opaque;
        }
    } catch (err) {
        warningLog("resolveDynamicExtensionObjectV: error getting constructor");
        warningLog("opaqueStructure = ", opaque.nodeId.toString());
        warningLog("err", (err as Error).message, (err as Error).stack);
        throw err;
    }
}

export async function resolveDynamicExtensionObject(
    session: IBasicSessionAsync2,
    variant: Variant,
    dataTypeManager: ExtraDataTypeManager,
    visited?: Set<any>
): Promise<void> {
    visited = visited || new Set();



    const handleValue = async (value: any): Promise<any> => {
        if (!value) {
            return value;
        }
        if (value instanceof OpaqueStructure) {
            return await resolveDynamicExtensionObjectV(session, value, dataTypeManager, visited!);
        }
        if (value instanceof ExtensionObject) {
            await resolveOpaqueStructureInExtensionObject(session, dataTypeManager, value, visited!);
            return value;
        }
        if (value instanceof Variant) {
            await resolveDynamicExtensionObject(session, value, dataTypeManager, visited!);
            return value;
        }
        return value;
    }

    if (variant.arrayType !== VariantArrayType.Scalar) {
        if (Array.isArray(variant.value)) {
            for (let i = 0; i < variant.value.length; i++) {
                variant.value[i] = await handleValue(variant.value[i]);
            }
        }
    } else {
        variant.value = await handleValue(variant.value);
    }
}
