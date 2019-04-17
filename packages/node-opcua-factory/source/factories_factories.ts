/**
 * @module node-opcua-factory
 */
// tslint:disable:no-console

import chalk from "chalk";
import * as  _ from "underscore";

import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { ExpandedNodeId } from "node-opcua-nodeid";

import { BaseUAObject } from "./factories_baseobject";
import { StructuredTypeSchema } from "./factories_structuredTypeSchema";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

const constructorMap: any = {};

type BaseUAObjectConstructable = new(options?: any) => BaseUAObject;
export type ConstructorFunc = BaseUAObjectConstructable;
// new (...args: any[]) => BaseUAObjectConstructable;

export interface ConstructorFuncWithSchema  extends ConstructorFunc {
    schema: StructuredTypeSchema;
    encodingDefaultBinary: ExpandedNodeId;
    encodingDefaultXml: ExpandedNodeId;
}

const _globalStructuredTypeConstructors: { [ key: string ]: ConstructorFuncWithSchema } = {};

export function getStructureTypeConstructor(typeName: string): ConstructorFunc {
    return _globalStructuredTypeConstructors[typeName];
}
export function hasStructuredType(typeName: string): boolean {
     return !!_globalStructuredTypeConstructors[typeName];
}
export function getStructuredTypeSchema(typeName: string): StructuredTypeSchema {
     const struct =  _globalStructuredTypeConstructors[typeName];
     if (!struct) {
         throw new Error("cannot find structured type for " + typeName);
     }
     return struct.schema;
}

export function registerFactory(typeName: string, constructor: ConstructorFuncWithSchema): void {
    /* istanbul ignore next */
    if (getStructureTypeConstructor(typeName)) {
        console.log(getStructureTypeConstructor(typeName));
        throw new Error(" registerFactory  : " + typeName + " already registered");
    }
    _globalStructuredTypeConstructors[typeName] = constructor;
}

/* istanbul ignore next */
export function dump(): void {
    console.log(" dumping registered factories");
    console.log(" Factory ", Object.keys(_globalStructuredTypeConstructors).sort().forEach((e) => e));
    console.log(" done");
}

export function callConstructor(constructor: ConstructorFunc): BaseUAObject {
    assert(_.isFunction(constructor));
    const constructorFunc: any = constructor.bind.apply(constructor, arguments as any);
    return new constructorFunc();
}

export function getConstructor(expandedNodeId: ExpandedNodeId): ConstructorFunc | null {

    const expandedNodeIdKey = makeExpandedNodeIdKey(expandedNodeId);

    if (!(expandedNodeId && (expandedNodeIdKey in constructorMap))) {
        debugLog(chalk.red("#getConstructor : cannot find constructor for expandedId "), expandedNodeId.toString());
        return null;
    }
    return constructorMap[expandedNodeIdKey];
}

export function hasConstructor(expandedNodeId: ExpandedNodeId): boolean {
    if (!expandedNodeId) {
        return false;
    }
    /* istanbul ignore next */
    if (!verifyExpandedNodeId(expandedNodeId)) {
        console.log("Invalid expandedNodeId");
        return false;
    }
    const expandedNodeIdKey = makeExpandedNodeIdKey(expandedNodeId);
    return !!constructorMap[expandedNodeIdKey];
}

export function constructObject(expandedNodeId: ExpandedNodeId): BaseUAObject  {

    if (!verifyExpandedNodeId(expandedNodeId)) {
        throw new Error(" constructObject : invalid expandedNodeId provided " + expandedNodeId.toString());
    }
    const constructor = getConstructor(expandedNodeId);

    if (!constructor) {
        debugLog("Cannot find constructor for " + expandedNodeId.toString());
        return new BaseUAObject();
        // throw new Error("Cannot find constructor for " + expandedNodeId.toString());
    }
    return callConstructor(constructor);

}

function verifyExpandedNodeId(expandedNodeId: ExpandedNodeId): boolean {
    /* istanbul ignore next */
    if (expandedNodeId.value instanceof Buffer) {
        throw new Error("getConstructor not implemented for opaque nodeid");
    }
    if (expandedNodeId.namespace === 0) {
        if (expandedNodeId.namespaceUri === "http://opcfoundation.org/UA/" || !expandedNodeId.namespaceUri ) {
            return true;
        }
        // When namespace is ZERO, namepaceUri must be "http://opcfoundation.org/UA/"  or nothing
        return false;
    } else {
        // expandedNodeId.namespace  !==0
        // in this case a valid expandedNodeId.namespaceUri  must be provided
        return !!expandedNodeId.namespaceUri && expandedNodeId.namespaceUri.length > 2;
    }
}
function makeExpandedNodeIdKey(expandedNodeId: ExpandedNodeId): string {
    if (expandedNodeId.namespace === 0) {
        return expandedNodeId.value.toString();
    }
    return expandedNodeId.namespaceUri + "@" + expandedNodeId.value.toString();
}

export function registerClassDefinition(className: string, classConstructor: ConstructorFuncWithSchema): void {

    registerFactory(className, classConstructor);

    const expandedNodeId = classConstructor.encodingDefaultBinary;

    if (doDebug) {
        debugLog(" registering ", className, expandedNodeId.toString());
    }

    /* istanbul ignore next */
    if (!verifyExpandedNodeId(expandedNodeId)) {
        throw new Error("Invalid expandedNodeId");
    }
    const expandedNodeIdKey = makeExpandedNodeIdKey(expandedNodeId);

    /* istanbul ignore next */
    if (expandedNodeIdKey in constructorMap) {
        throw new Error(" Class " + className + " with ID " + expandedNodeId +
          "  already in constructorMap for  " + constructorMap[expandedNodeIdKey].name);
    }

    constructorMap[expandedNodeIdKey] = classConstructor;
}
