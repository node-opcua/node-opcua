/**
 * @module node-opcua-factory
 */
// tslint:disable:no-console

import * as chalk from "chalk";
import * as  _ from "underscore";

import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { ExpandedNodeId, NodeId } from "node-opcua-nodeid";

import {
    DataTypeFactory,
} from "./datatype_factory";
import {
    ConstructorFuncWithSchema,
    ConstructorFunc
} from "./constructor_type";

import { BaseUAObject } from "./factories_baseobject";
import { StructuredTypeSchema } from "./factories_structuredTypeSchema";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

let globalFactory: DataTypeFactory;
export function getStandartDataTypeFactory(): DataTypeFactory {
    if (!globalFactory) {
        globalFactory = new DataTypeFactory([]);
        globalFactory.targetNamespace = "http://opcfoundation.org/UA/";
    }
    return globalFactory;
}
export function getStructureTypeConstructor(typeName: string): ConstructorFuncWithSchema {
    return getStandartDataTypeFactory().getStructureTypeConstructor(typeName);
}
export function hasStructuredType(typeName: string): boolean {
    return getStandartDataTypeFactory().hasStructuredType(typeName);
}
export function getStructuredTypeSchema(typeName: string): StructuredTypeSchema {
    return getStandartDataTypeFactory().getStructuredTypeSchema(typeName);
}

export function getConstructor(binaryEncodingNodeId: ExpandedNodeId): ConstructorFunc | null {
    return getStandartDataTypeFactory().getConstructor(binaryEncodingNodeId);
}
export function hasConstructor(binaryEncodingNodeId: ExpandedNodeId): boolean {
    return getStandartDataTypeFactory().hasConstructor(binaryEncodingNodeId);
}
export function constructObject(binaryEncodingNodeId: ExpandedNodeId): BaseUAObject {
    return getStandartDataTypeFactory().constructObject(binaryEncodingNodeId);
}
export function registerClassDefinition(dataTypeNodeId: NodeId, className: string, classConstructor: ConstructorFuncWithSchema): void {
    return getStandartDataTypeFactory().registerClassDefinition(dataTypeNodeId, className, classConstructor);
}
/* istanbul ignore next */
export function dump(): void {
    getStandartDataTypeFactory().dump();
}