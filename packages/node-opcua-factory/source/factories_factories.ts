/**
 * @module node-opcua-factory
 */
// tslint:disable:no-console

import * as chalk from "chalk";

import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { ExpandedNodeId, NodeId } from "node-opcua-nodeid";

import { DataTypeFactory } from "./datatype_factory";
import { ConstructorFuncWithSchema, ConstructorFunc } from "./constructor_type";

import { BaseUAObject } from "./factories_baseobject";
import { StructuredTypeSchema } from "./factories_structuredTypeSchema";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

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
export function getStructuredTypeSchema(typeName: string): StructuredTypeSchema {
    return getStandardDataTypeFactory().getStructuredTypeSchema(typeName);
}

export function getConstructor(binaryEncodingNodeId: ExpandedNodeId): ConstructorFunc | null {
    return getStandardDataTypeFactory().getConstructor(binaryEncodingNodeId);
}
export function hasConstructor(binaryEncodingNodeId: ExpandedNodeId): boolean {
    return getStandardDataTypeFactory().hasConstructor(binaryEncodingNodeId);
}
export function constructObject(binaryEncodingNodeId: ExpandedNodeId): BaseUAObject {
    return getStandardDataTypeFactory().constructObject(binaryEncodingNodeId);
}
export function registerClassDefinition(
    dataTypeNodeId: NodeId,
    className: string,
    classConstructor: ConstructorFuncWithSchema
): void {
    return getStandardDataTypeFactory().registerClassDefinition(dataTypeNodeId, className, classConstructor);
}
/* istanbul ignore next */
export function dump(): void {
    getStandardDataTypeFactory().dump();
}
