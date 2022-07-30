import { ExpandedNodeId } from "node-opcua-nodeid";
import { getStandardDataTypeFactory } from "./get_standard_data_type_factory";
import { IBaseUAObject, IStructuredTypeSchema } from "./types";

export function getStructuredTypeSchema(typeName: string): IStructuredTypeSchema {
    return getStandardDataTypeFactory().getStructuredTypeSchema(typeName);
}
export function constructObject(binaryEncodingNodeId: ExpandedNodeId): IBaseUAObject {
    return getStandardDataTypeFactory().constructObject(binaryEncodingNodeId);
}
