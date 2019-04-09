import { BinaryStream } from "node-opcua-binary-stream";
import { OpaqueStructure } from "node-opcua-extension-object";
import { constructObject } from "node-opcua-factory";
import { ExpandedNodeId } from "node-opcua-nodeid";
import { DataType, Variant } from "node-opcua-variant";

import { ExtraDataTypeManager } from "./extra_data_type_manager";

export async function resolveDynamicExtensionObject(
  variant: Variant,
  extraDataType: ExtraDataTypeManager
) {

    if (variant.dataType !== DataType.ExtensionObject) {
        return;
    }
    if (!(variant.value instanceof OpaqueStructure)) {
        return;
    }

    const opaque = variant.value as OpaqueStructure;

    const namespaceUri = extraDataType.namespaceArray[opaque.nodeId.namespace];
    const exapndedNodeId  = ExpandedNodeId.fromNodeId(opaque.nodeId, namespaceUri);

    const object = constructObject(exapndedNodeId);

    const stream = new BinaryStream(opaque.buffer);
    object.decode(stream);

    variant.value = object;

}
