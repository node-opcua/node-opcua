/**
 * @module node-opcua-factory
 */
// tslint:disable:no-console
import * as chalk from "chalk";
import * as  _ from "underscore";
import * as util from "util";

import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { ExpandedNodeId, NodeId } from "node-opcua-nodeid";

import { ConstructorFunc, ConstructorFuncWithSchema } from "./constructor_type";
import { BaseUAObject } from "./factories_baseobject";
import { EnumerationDefinitionSchema, hasEnumeration, getEnumeration } from "./factories_enumerations";
import { StructuredTypeSchema } from "./factories_structuredTypeSchema";
import { hasBuiltInType, getBuildInType } from "./factories_builtin_types";
import { BasicTypeDefinition } from ".";
import { link } from "fs";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

export class DataTypeFactory {

    public defaultByteOrder: string;
    public targetNamespace: string;
    public imports: string[] = [];

    private _structureTypeConstructorByNameMap: { [key: string]: ConstructorFuncWithSchema } = {};
    private _structureTypeConstructorByDataTypeMap: { [key: string]: ConstructorFuncWithSchema } = {};
    private _structureTypeConstructorByEncodingNodeIdMap: any = {};

    private _enumerations: {
        [key: string]: EnumerationDefinitionSchema
    } = {};
    private _simpleTypes: {
        [key: string]: { nodeId: NodeId, definition: BasicTypeDefinition }
    } = {};

    private readonly baseDataFactories: DataTypeFactory[];

    public constructor(baseDataFactories: DataTypeFactory[]) {
        this.defaultByteOrder = "LittleEndian";
        this.targetNamespace = "";
        this.baseDataFactories = baseDataFactories;
    }

    // -----------------------------
    public registerSimpleType(name: string, dataTypeNodeId: NodeId, def: BasicTypeDefinition) {
        if (this._simpleTypes[name]) {
            throw new Error("registerSimpleType " + name + " already register");
        }
        this._simpleTypes[name] = { nodeId: dataTypeNodeId, definition: def };
    }

    public hasSimpleType(name: string): boolean {
        if (this._simpleTypes[name]) {
            return true;
        }
        for (const factory of this.baseDataFactories) {
            if (factory.hasSimpleType(name)) {
                return true;
            }
        }
        const hasSimpleT = hasBuiltInType(name);
        if (hasSimpleT) {
            return hasSimpleT;
        }
        return hasBuiltInType(name);
    }
    public getSimpleType(name: string): BasicTypeDefinition {
        if (this._simpleTypes[name]) {
            return this._simpleTypes[name].definition;
        }
        for (const factory of this.baseDataFactories) {
            if (factory.hasSimpleType(name)) {
                return factory.getSimpleType(name);
            }
        }
        return getBuildInType(name);
    }
    // -----------------------------
    // EnumerationDefinitionSchema
    public registerEnumeration(enumeration: EnumerationDefinitionSchema): void {
        assert(!this._enumerations[enumeration.name]);
        this._enumerations[enumeration.name] = enumeration;
    }
    public hasEnumeration(enumName: string): boolean {
        if (this._enumerations[enumName]) {
            return true;
        }
        for (const factory of this.baseDataFactories) {
            const e = factory.hasEnumeration(enumName);
            if (e) {
                return true;
            }
        }
        if (hasEnumeration(enumName)) {
            return true;
        }
        return false;
    }
    public getEnumeration(enumName: string): EnumerationDefinitionSchema | null {
        if (this._enumerations[enumName]) {
            return this._enumerations[enumName];
        }
        for (const factory of this.baseDataFactories) {
            const e = factory.getEnumeration(enumName);
            if (e !== null) {
                return e;
            }
        }
        const ee = getEnumeration(enumName);
        return ee;
    }
    //  ----------------------------

    public findConstructorForDataType(dataTypeNodeId: NodeId): ConstructorFuncWithSchema {
        const constructor = this._structureTypeConstructorByDataTypeMap[dataTypeNodeId.toString()];
        if (constructor) {
            return constructor;
        }
        for (const factory of this.baseDataFactories) {
            const constructor2 = factory.findConstructorForDataType(dataTypeNodeId);
            if (constructor2) {
                return constructor2;
            }
        }
        throw new Error("Cannot find StructureType constructor for dataType " + dataTypeNodeId.toString());
    }
    // ----------------------------------------------------------------------------------------------------
    // Acces by typeName
    // ----------------------------------------------------------------------------------------------------
    public structuredTypesNames(): string[] {
        return Object.keys(this._structureTypeConstructorByNameMap);
    }

    public getStructureTypeConstructor(typeName: string): ConstructorFuncWithSchema {
        const constructor = this._structureTypeConstructorByNameMap[typeName];
        if (constructor) {
            return constructor;
        }
        for (const factory of this.baseDataFactories) {
            if (!factory.hasStructuredType(typeName)) {
                continue;
            }
            const constructor2 = factory.getStructureTypeConstructor(typeName);
            if (constructor2) {
                return constructor2;
            }
        }
        throw new Error("Cannot find StructureType constructor for " + typeName + " - it may be abstract, or it could be a basic type");
    }

    public hasStructuredType(typeName: string): boolean {
        const flag = !!this._structureTypeConstructorByNameMap[typeName];
        if (flag) { return true; }
        for (const factory of this.baseDataFactories) {
            const flag2 = factory.hasStructuredType(typeName);
            if (flag2) {
                return true;
            }
        }
        return false;
    }

    public getStructuredTypeSchema(typeName: string): StructuredTypeSchema {
        const constructor = this.getStructureTypeConstructor(typeName);
        return constructor.schema;
    }

    public dump(): void {
        console.log(" dumping registered factories");
        console.log(" Factory ", Object.keys(this._structureTypeConstructorByNameMap)
            .sort().forEach((e) => e));
        console.log(" done");
    }

    public registerClassDefinition(dataTypeNodeId: NodeId, className: string, classConstructor: ConstructorFuncWithSchema): void {
        this._registerFactory(dataTypeNodeId, className, classConstructor);
        if (classConstructor.encodingDefaultBinary && classConstructor.encodingDefaultBinary.value !== 0) {
            this.associateWithBinaryEncoding(className, classConstructor.encodingDefaultBinary);
        } else {
            console.log("warning ", dataTypeNodeId.toString, "name= ", className, " do not have binary encoding");
        }
    }

    // ----------------------------------------------------------------------------------------------------
    // Acces by binaryEncodingNodeId
    // ----------------------------------------------------------------------------------------------------
    public getConstructor(binaryEncodingNodeId: NodeId): ConstructorFunc | null {
        const expandedNodeIdKey = makeExpandedNodeIdKey(binaryEncodingNodeId);
        const constructor = this._structureTypeConstructorByEncodingNodeIdMap[expandedNodeIdKey];
        if (constructor) {
            return constructor;
        }
        for (const factory of this.baseDataFactories) {
            const constructor2 = factory.getConstructor(binaryEncodingNodeId);
            if (constructor2) {
                return constructor2;
            }
        }
        debugLog(chalk.red("#getConstructor : cannot find constructor for expandedId "), binaryEncodingNodeId.toString());
        return null;
    }

    public hasConstructor(binaryEncodingNodeId: NodeId): boolean {
        if (!binaryEncodingNodeId) {
            return false;
        }
        /* istanbul ignore next */
        if (!verifyExpandedNodeId(binaryEncodingNodeId)) {
            console.log("Invalid expandedNodeId");
            return false;
        }
        const expandedNodeIdKey = makeExpandedNodeIdKey(binaryEncodingNodeId);
        const constructor = this._structureTypeConstructorByEncodingNodeIdMap[expandedNodeIdKey];
        if (constructor) {
            return true;
        }
        for (const factory of this.baseDataFactories) {
            const constructor2 = factory.getConstructor(binaryEncodingNodeId);
            if (constructor2) {
                return true;
            }
        }
        return false;
    }

    public constructObject(binaryEncodingNodeId: NodeId): BaseUAObject {
        if (!verifyExpandedNodeId(binaryEncodingNodeId)) {
            throw new Error(" constructObject : invalid expandedNodeId provided " + binaryEncodingNodeId.toString());
        }
        const constructor = this.getConstructor(binaryEncodingNodeId);

        if (!constructor) {
            debugLog("Cannot find constructor for " + binaryEncodingNodeId.toString());
            return new BaseUAObject();
            // throw new Error("Cannot find constructor for " + expandedNodeId.toString());
        }
        return callConstructor(constructor);

    }

    public associateWithBinaryEncoding(className: string, expandedNodeId: ExpandedNodeId) {
        const classConstructor = this.getStructureTypeConstructor(className);
        if (doDebug) {
            debugLog(" associateWithBinaryEncoding ", className, expandedNodeId.toString());
        }

        /* istanbul ignore next */
        if (!verifyExpandedNodeId(expandedNodeId)) {
            throw new Error("Invalid expandedNodeId " + expandedNodeId.toString() + " className = " + className);
        }
        const expandedNodeIdKey = makeExpandedNodeIdKey(expandedNodeId);

        /* istanbul ignore next */
        if (expandedNodeIdKey in this._structureTypeConstructorByEncodingNodeIdMap) {
            throw new Error(" Class " + className + " with ID " + expandedNodeId +
                "  already in constructorMap for  " + this._structureTypeConstructorByEncodingNodeIdMap[expandedNodeIdKey].name);
        }

        this._structureTypeConstructorByEncodingNodeIdMap[expandedNodeIdKey] = classConstructor;
    }

    private _registerFactory(dataTypeNodeId: NodeId, typeName: string, constructor: ConstructorFuncWithSchema): void {
        assert(dataTypeNodeId.value !== 0, "dataTypeNodeId cannot be null");
        /* istanbul ignore next */
        if (this.hasStructuredType(typeName)) {
            console.log(this.getStructureTypeConstructor(typeName));
            console.log("target namespace =", this.targetNamespace);
            throw new Error(" registerFactory  : " + typeName + " already registered");
        }
        debugLog("registerning typeName ", typeName, dataTypeNodeId.toString());
        this._structureTypeConstructorByNameMap[typeName] = constructor;
        this._structureTypeConstructorByDataTypeMap[dataTypeNodeId.toString()] = constructor;
        Object.defineProperty(constructor.schema, "$$factory", {
            enumerable: false,
            value: this,
            writable: false,
        });
    }

    public toString(): string {
        const l: string[] = [];
        function write(...args: [any, ...any[]]) {
            l.push(util.format.apply(util.format, args));
        }
        dumpDataFactory(this, write);
        return l.join("\n");
    }
}

function dumpSchema(schema: StructuredTypeSchema, write: any) {
    write("name           ", schema.name);
    write("dataType       ", schema.dataTypeNodeId.toString());
    write("binaryEncoding ", schema.encodingDefaultBinary!.toString());
    for (const f of schema.fields) {
        write("          ", f.name.padEnd(30, " "), f.isArray ? true : false, f.fieldType);
    }
}
function dumpDataFactory(dataFactory: DataTypeFactory, write: any) {

    for (const structureTypeName of dataFactory.structuredTypesNames()) {
        const schema = dataFactory.getStructuredTypeSchema(structureTypeName);

        if (!dataFactory.findConstructorForDataType(schema.dataTypeNodeId)) {
            write("  ( No constructor for " + schema.name + "  " + schema.dataTypeNodeId.toString());
        }
        if (dataFactory.hasConstructor(schema.encodingDefaultBinary!)) {
            throw new Error("Not  in Binary Encoding Map!!!!!");
        }
        write("structureTypeName =", structureTypeName);
        dumpSchema(schema, write);
    }
}

function verifyExpandedNodeId(expandedNodeId: NodeId): boolean {
    /* istanbul ignore next */
    if (expandedNodeId.value instanceof Buffer) {
        throw new Error("getConstructor not implemented for opaque nodeid");
    }
    return true;
}

function makeExpandedNodeIdKey(expandedNodeId: NodeId): string {
    return expandedNodeId.toString();
}

export function callConstructor(constructor: ConstructorFunc): BaseUAObject {
    assert(_.isFunction(constructor));
    const constructorFunc: any = constructor.bind.apply(constructor, arguments as any);
    return new constructorFunc();
}
