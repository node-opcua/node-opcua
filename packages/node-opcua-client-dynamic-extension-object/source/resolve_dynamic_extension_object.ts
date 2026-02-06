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

const warningLog = make_warningLog(__filename);
const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

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

        if (element instanceof Variant || element.constructor?.name === "Variant") {
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
            try {
                const Constructor = await dataTypeManager.getExtensionObjectConstructorFromBinaryEncodingAsync(value.nodeId);
                const object = new Constructor();
                const stream = new BinaryStream(value.buffer);
                try {
                    object.decode(stream);
                    await resolveOpaqueStructureInExtensionObject(session, dataTypeManager, object, visited!);
                    return object;
                } catch (err) {
                    warningLog("resolveDynamicExtensionObjectV: error decoding or resolving inner structures");
                    warningLog("Constructor = ", Constructor.name);
                    warningLog("opaqueStructure = ", value?.nodeId?.toString());
                    warningLog("resolveDynamicExtensionObjectV err = ", (err as Error).message, (err as Error).stack);
                    return value;
                }
            } catch (err) {
                warningLog("resolveDynamicExtensionObjectV: error getting constructor");
                warningLog("opaqueStructure = ", value.nodeId.toString());
                warningLog("err", (err as Error).message, (err as Error).stack);
                return value;
            }
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
