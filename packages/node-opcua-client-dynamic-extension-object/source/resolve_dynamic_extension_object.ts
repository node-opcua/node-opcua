import { BinaryStream } from "node-opcua-binary-stream";
import { ExtensionObject, OpaqueStructure } from "node-opcua-extension-object";
import { constructObject } from "node-opcua-factory";
import { ExpandedNodeId } from "node-opcua-nodeid";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";

import { ExtraDataTypeManager } from "./extra_data_type_manager";

function resolveDynamicExtensionObjectV(
    opaque: OpaqueStructure,
    extraDataType: ExtraDataTypeManager
): ExtensionObject {

    try {
        const namespaceUri = extraDataType.namespaceArray[opaque.nodeId.namespace];
        const expandedNodeId = ExpandedNodeId.fromNodeId(opaque.nodeId, namespaceUri);

        const typeDictionary = extraDataType.getTypeDictionaryForNamespace(opaque.nodeId.namespace);

        const Constructor = extraDataType.getExtensionObjectConstructorFromBinaryEncoding(opaque.nodeId);
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
    extraDataType: ExtraDataTypeManager
): Promise<void> {

    if (variant.dataType !== DataType.ExtensionObject) {
        return;
    }
    if (variant.arrayType !== VariantArrayType.Scalar) {

        if (variant.value instanceof Array) {
            variant.value = (variant.value as any[]).map((v: any) => {

                if (!(v instanceof OpaqueStructure)) {
                    return v;
                }
                const obj = resolveDynamicExtensionObjectV(v as OpaqueStructure, extraDataType);
                return obj;
            });
        }
        return;
    }

    if (!(variant.value instanceof OpaqueStructure)) {
        return;
    }
    variant.value = resolveDynamicExtensionObjectV(
        variant.value as OpaqueStructure, extraDataType);

}
