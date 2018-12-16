/**
 * @module node-opcua-factory
 * @class Factory
 * @static
 */
// tslint:disable:no-console

import chalk from "chalk";
import assert from "node-opcua-assert";
import { ExpandedNodeId } from "node-opcua-nodeid";
import * as  _ from "underscore";

import { BaseUAObject } from "./factories_baseobject";
import { StructuredTypeSchema } from "./factories_structuredTypeSchema";

const constructorMap: any = {};

interface BaseUAObjectConstructable {
    new(options?: any): BaseUAObject;
}
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
     return _globalStructuredTypeConstructors[typeName].schema;
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

export function getConstructor(expandedId: ExpandedNodeId): ConstructorFunc | null {

    if (!(expandedId && (expandedId.value in constructorMap))) {
        console.log(chalk.red("#getConstructor : cannot find constructor for expandedId "), expandedId.toString());
        return null;
    }
    return constructorMap[expandedId.value];
}

export function hasConstructor(expandedId: ExpandedNodeId) {
    if (!expandedId) {
        return false;
    }
    assert(expandedId.hasOwnProperty("value"));
    // only namespace 0 can be in constructorMap
    if (expandedId.namespace !== 0) {
        return false;
    }
    return !!constructorMap[expandedId.value];
}

export function constructObject(expandedNodeId: ExpandedNodeId): BaseUAObject  {
    const constructor = getConstructor(expandedNodeId);
    if (!constructor) {
        throw new Error("Cannot find constructor for " + expandedNodeId.toString());
    }
    return callConstructor(constructor);
}

export function registerClassDefinition(className: string, classConstructor: ConstructorFuncWithSchema): void {

    registerFactory(className, classConstructor);

    const expandedNodeId = classConstructor.encodingDefaultBinary;

    /* istanbul ignore next */
    if (expandedNodeId.value in constructorMap) {
        throw new Error(" Class " + className + " with ID " + expandedNodeId +
          "  already in constructorMap for  " + constructorMap[expandedNodeId.value].name);
    }
    constructorMap[expandedNodeId.value] = classConstructor;
}
