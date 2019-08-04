/**
 * @module node-opcua-factory
 */
// tslint:disable:no-console

import chalk from "chalk";
import * as  _ from "underscore";

import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { ExpandedNodeId } from "node-opcua-nodeid";

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
export function registerFactory(typeName: string, constructor: ConstructorFuncWithSchema): void {    
    return getStandartDataTypeFactory().registerFactory(typeName, constructor);
}
export function getConstructor(expandedNodeId: ExpandedNodeId): ConstructorFunc | null {
    return getStandartDataTypeFactory().getConstructor(expandedNodeId);
}
export function hasConstructor(expandedNodeId: ExpandedNodeId): boolean {
    return getStandartDataTypeFactory().hasConstructor(expandedNodeId);
}
export function constructObject(expandedNodeId: ExpandedNodeId): BaseUAObject  {
    return getStandartDataTypeFactory().constructObject(expandedNodeId);
}
export function registerClassDefinition(className: string, classConstructor: ConstructorFuncWithSchema): void {
    return getStandartDataTypeFactory().registerClassDefinition(className,classConstructor);
}
/* istanbul ignore next */
export function dump(): void {
    getStandartDataTypeFactory().dump();
}