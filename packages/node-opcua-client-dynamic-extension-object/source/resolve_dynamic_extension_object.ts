import { BinaryStream } from "node-opcua-binary-stream";
import { ExtensionObject, OpaqueStructure } from "node-opcua-extension-object";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";

import { ExtraDataTypeManager } from "./extra_data_type_manager";

function resolveDynamicExtensionObjectV(
    opaque: OpaqueStructure,
    dataTypeManager: ExtraDataTypeManager
): ExtensionObject {

    try {
        const Constructor = dataTypeManager.getExtensionObjectConstructorFromBinaryEncoding(opaque.nodeId);
        const object = new Constructor();
        const stream = new BinaryStream(opaque.buffer);
        object.decode(stream);
        return object;
    } catch (err) {
        // tslint:disable-next-line:no-console
        console.log("resolveDynamicExtensionObjectV err = ", err);
        return opaque;
    }
}

export async function resolveDynamicExtensionObject(
    variant: Variant,
    dataTypeManager: ExtraDataTypeManager
): Promise<void> {

    if (variant.dataType !== DataType.ExtensionObject) {
        return;
    }
    if (variant.arrayType !== VariantArrayType.Scalar) {

        if (variant.value instanceof Array) {
            variant.value = (variant.value as OpaqueStructure[]).map((v: OpaqueStructure) => {
                const obj = resolveDynamicExtensionObjectV(v, dataTypeManager);
                return obj;
            });
        }
        return;
    }

    if (!(variant.value instanceof OpaqueStructure)) {
        return;
    }
    variant.value = resolveDynamicExtensionObjectV(
        variant.value as OpaqueStructure, dataTypeManager);

}
