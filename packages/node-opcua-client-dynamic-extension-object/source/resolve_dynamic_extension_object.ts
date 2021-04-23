import { BinaryStream } from "node-opcua-binary-stream";
import { ExtensionObject, OpaqueStructure } from "node-opcua-extension-object";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";

import { ExtraDataTypeManager } from "./extra_data_type_manager";
import { hexDump } from "node-opcua-debug";

function resolveDynamicExtensionObjectV(opaque: OpaqueStructure, dataTypeManager: ExtraDataTypeManager): ExtensionObject {
    try {
        const Constructor = dataTypeManager.getExtensionObjectConstructorFromBinaryEncoding(opaque.nodeId);
        const object = new Constructor();
        const stream = new BinaryStream(opaque.buffer);
        try {
            object.decode(stream);
            return object;
        } catch (err) {
            // tslint:disable-next-line:no-console
            console.log("Constructor = ", Constructor.name);
            // tslint:disable-next-line:no-console
            console.log("opaqueStructure = ", opaque?.nodeId?.toString());
            // tslint:disable-next-line:no-console
            console.log("opaqueStructure = ", "0x" + opaque?.buffer?.toString("hex"));
            // tslint:disable-next-line: no-console
            console.log(hexDump(opaque.buffer));
            // tslint:disable-next-line:no-console
            console.log("resolveDynamicExtensionObjectV err = ", err);
            // try again for debugging
            object.decode(stream);
            return opaque;
        }
    } catch (err) {
        console.log("err", err);
        // tslint:disable-next-line:no-console
        console.log("opaqueStructure = ", opaque.nodeId.toString());
        // tslint:disable-next-line:no-console
        console.log("opaqueStructure = ", "0x" + opaque.buffer.toString("hex"));
        // tslint:disable-next-line: no-console
        console.log(hexDump(opaque.buffer));
        console.log(dataTypeManager.toString());
        throw err;
    }
}

export function resolveDynamicExtensionObject(variant: Variant, dataTypeManager: ExtraDataTypeManager): void {
    if (variant.dataType !== DataType.ExtensionObject) {
        return;
    }
    if (variant.arrayType !== VariantArrayType.Scalar) {
        if (variant.value instanceof Array) {
            variant.value = (variant.value as any[]).map((v: any) => {
                const obj = v instanceof OpaqueStructure ? resolveDynamicExtensionObjectV(v, dataTypeManager) : v;
                return obj;
            });
        }
        return;
    }

    if (!(variant.value instanceof OpaqueStructure)) {
        return;
    }
    variant.value = resolveDynamicExtensionObjectV(variant.value as OpaqueStructure, dataTypeManager);
}
