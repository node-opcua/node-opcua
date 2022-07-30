/**
 * @module node-opcua-factory
 */
import { ExpandedNodeId, NodeId } from "node-opcua-nodeid";

import { DataTypeFactory } from "./datatype_factory";

import { ConstructorFunc, ConstructorFuncWithSchema } from "./types";

let globalFactory: DataTypeFactory;

export function getStandardDataTypeFactory(): DataTypeFactory {
    if (!globalFactory) {
        globalFactory = new DataTypeFactory([]);
        globalFactory.targetNamespace = "http://opcfoundation.org/UA/";
    }
    return globalFactory;
}

export function getStructureTypeConstructor(typeName: string): ConstructorFuncWithSchema {
    return getStandardDataTypeFactory().getStructureTypeConstructor(typeName);
}

export function hasStructuredType(typeName: string): boolean {
    return getStandardDataTypeFactory().hasStructuredType(typeName);
}

export function getConstructor(binaryEncodingNodeId: ExpandedNodeId): ConstructorFunc | null {
    return getStandardDataTypeFactory().getConstructor(binaryEncodingNodeId);
}

export function hasConstructor(binaryEncodingNodeId: ExpandedNodeId): boolean {
    return getStandardDataTypeFactory().hasConstructor(binaryEncodingNodeId);
}


/* istanbul ignore next */
export function dump(): void {
    getStandardDataTypeFactory().dump();
}
