import { BinaryStream } from "node-opcua-binary-stream";
import { make_warningLog } from "node-opcua-debug";
import { ExtensionObject, OpaqueStructure } from "node-opcua-extension-object";
import type { IBaseUAObject, StructuredTypeField } from "node-opcua-factory";
import type { IBasicSessionAsync2 } from "node-opcua-pseudo-session";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
//
import type { ExtraDataTypeManager } from "./extra_data_type_manager";

const warningLog = make_warningLog("resolve_dynamic_extension_object");

export async function resolveOpaqueStructureInExtensionObject(
    session: IBasicSessionAsync2,
    dataTypeManager: ExtraDataTypeManager,
    object: ExtensionObject,
    visitedParam?: Set<unknown>
): Promise<void> {
    const visited = visitedParam || new Set<unknown>();
    if (visited.has(object)) {
        return;
    }
    visited.add(object);

    interface D {
        dataTypeManager: ExtraDataTypeManager;
        promises: Promise<void>[];
        visited: Set<unknown>;
    }
    async function fixOpaqueStructureOnElement(
        element: unknown,
        _field: StructuredTypeField,
        data: D,
        _args?: unknown
    ): Promise<unknown> {
        if (!element) {
            return element;
        }
        const elementAsRecord = element as { constructor?: { name?: string; schema?: { name?: string } } };

        if (element instanceof Variant || elementAsRecord.constructor?.name === "Variant") {
            await resolveDynamicExtensionObject(session, element as Variant, dataTypeManager, data.visited);
            return element;
        }
        if (element instanceof ExtensionObject || elementAsRecord.constructor?.schema?.name === "ExtensionObject") {
            if (element instanceof OpaqueStructure) {
                const variant = new Variant({ dataType: DataType.ExtensionObject, value: element });
                await resolveDynamicExtensionObject(session, variant, dataTypeManager, data.visited);
                return variant.value as unknown;
            } else {
                await resolveOpaqueStructureInExtensionObject(session, dataTypeManager, element as ExtensionObject, data.visited);
                return element;
            }
        }
        return element;
    }
    function fixOpaqueStructure(objectArg: IBaseUAObject, field: StructuredTypeField, data: D, args?: unknown) {
        const object = objectArg as unknown as Record<string, unknown>;
        const a = object[field.name];
        if (!a) {
            return;
        }
        if (field.isArray) {
            const arr = a as unknown[];
            for (let i = 0; i < arr.length; i++) {
                const x = arr[i];
                data.promises.push(
                    (async () => {
                        arr[i] = await fixOpaqueStructureOnElement(x, field, data, args);
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
    visitedParam?: Set<unknown>
): Promise<void> {
    const visited = visitedParam || new Set<unknown>();

    const handleValue = async (value: unknown): Promise<unknown> => {
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
                    await resolveOpaqueStructureInExtensionObject(session, dataTypeManager, object, visited);
                    return object;
                } catch (err) {
                    warningLog("resolveDynamicExtensionObjectV: error decoding or resolving inner structures");
                    warningLog("Constructor = ", Constructor.name);
                    warningLog(" partial object = ", object.toString());
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
            await resolveOpaqueStructureInExtensionObject(session, dataTypeManager, value, visited);
            return value;
        }
        if (value instanceof Variant) {
            await resolveDynamicExtensionObject(session, value, dataTypeManager, visited);
            return value;
        }
        return value;
    };

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
