import { BinaryStream } from "node-opcua-binary-stream";
import { ExtensionObject, OpaqueStructure } from "node-opcua-extension-object";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import { hexDump, make_warningLog } from "node-opcua-debug";
import { IBasicSession } from "node-opcua-pseudo-session";
import { NodeId } from "node-opcua-nodeid";
import { ConstructorFunc, StructuredTypeField } from "node-opcua-factory";
import { BrowseDirection, NodeClassMask, ResultMask } from "node-opcua-data-model";
//
import { ExtraDataTypeManager } from "./extra_data_type_manager";
import { readDataTypeDefinitionAndBuildType } from "./private/populate_data_type_manager_104";

const warningLog = make_warningLog(__filename);

async function getOrExtractConstructor(
    session: IBasicSession,
    binaryEncodingNodeId: NodeId,
    dataTypeManager: ExtraDataTypeManager
): Promise<ConstructorFunc> {
    const dataTypeFactory = dataTypeManager.getDataTypeFactoryForNamespace(binaryEncodingNodeId.namespace);

    const Constructor = dataTypeFactory.getConstructor(binaryEncodingNodeId);
    if (Constructor) {
        return Constructor;
    }
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
        throw new Error("Internal Error: we are not expecting this dataType to be processed already " + dataTypeNodeId.toString());
    }
    await readDataTypeDefinitionAndBuildType(session, dataTypeNodeId, r.browseName.name!, dataTypeFactory, {});

    const structureInfo = dataTypeFactory.getStructureInfoForDataType(dataTypeNodeId)!;
    if (!structureInfo.constructor) {
        throw new Error("Cannot find constructor for abstract DataType");
    }
    return structureInfo.constructor;
}

export async function resolveOpaqueStructureInExtentionObject(
    session: IBasicSession,
    dataTypeManager: ExtraDataTypeManager,
    object: ExtensionObject
): Promise<void> {
    const schema = object.schema;
    interface D {
        dataTypeManager: ExtraDataTypeManager;
        promises: Promise<void>[];
    }
    async function fixOpaqueStructureOnElement(
        element: Record<string, unknown>,
        field: StructuredTypeField,
        data: D,
        args?: any
    ): Promise<unknown> {
        if (element instanceof Variant) {
            await resolveDynamicExtensionObject(session, element, dataTypeManager);
            return element;
        }
        if (!(element instanceof OpaqueStructure)) {
            return element;
        }
        const variant = new Variant({ dataType: DataType.ExtensionObject, value: element });
        await resolveDynamicExtensionObject(session, variant, dataTypeManager);
        return variant.value as unknown;
    }
    function fixOpaqueStructure(object: any, field: StructuredTypeField, data: D, args?: any) {
        if (field.category === "complex" && !field.allowSubType) {
            return;
        }
        if (field.category === "basic" && field.fieldType !== "Variant") {
            return;
        }
        const a = object[field.name];
        if (!a) {
            return;
        }
        if (field.isArray) {
            for (let i = 0; i < a.length; i++) {
                const x = a[i];
                promises.push(
                    (async () => {
                        a[i] = await fixOpaqueStructureOnElement(x, field, data, args);
                    })()
                );
            }
        } else {
            promises.push(
                (async () => {
                    object[field.name] = await fixOpaqueStructureOnElement(a, field, data, args);
                })()
            );
        }
    }
    const promises: Promise<void>[] = [];
    object.applyOnAllFields<D>(fixOpaqueStructure, { dataTypeManager, promises });
    await Promise.all(promises);
}

async function resolveDynamicExtensionObjectV(
    session: IBasicSession,
    opaque: OpaqueStructure,
    dataTypeManager: ExtraDataTypeManager
): Promise<ExtensionObject> {
    try {
        const Constructor = await getOrExtractConstructor(session, opaque.nodeId, dataTypeManager);
        const object = new Constructor();
        const stream = new BinaryStream(opaque.buffer);
        try {
            object.decode(stream);
            await resolveOpaqueStructureInExtentionObject(session, dataTypeManager, object);
            return object;
        } catch (err) {
            warningLog("Constructor = ", Constructor.name);
            warningLog("opaqueStructure = ", opaque?.nodeId?.toString());
            warningLog("opaqueStructure = ", hexDump(opaque.buffer, 132, 100));
            warningLog(hexDump(opaque.buffer));
            warningLog("resolveDynamicExtensionObjectV err = ", err);
            // try again for debugging
            object.decode(stream);
            return opaque;
        }
    } catch (err) {
        warningLog("err", err);
        warningLog("opaqueStructure = ", opaque.nodeId.toString());
        warningLog("opaqueStructure = ", "0x" + hexDump(opaque.buffer, 132, 100));
        warningLog(hexDump(opaque.buffer));
        warningLog(dataTypeManager.toString());
        throw err;
    }
}

export async function resolveDynamicExtensionObject(
    session: IBasicSession,
    variant: Variant,
    dataTypeManager: ExtraDataTypeManager
): Promise<void> {
    if (variant.dataType !== DataType.ExtensionObject) {
        return;
    }
    if (variant.arrayType !== VariantArrayType.Scalar) {
        if (variant.value instanceof Array) {
            for (let i = 0; i < variant.value.length; i++) {
                if (variant.value[i] instanceof OpaqueStructure) {
                    variant.value[i] = await resolveDynamicExtensionObjectV(session, variant.value[i], dataTypeManager);
                }
            }
        }
        return;
    }

    if (!(variant.value instanceof OpaqueStructure)) {
        return;
    }
    variant.value = await resolveDynamicExtensionObjectV(session, variant.value, dataTypeManager);
}
