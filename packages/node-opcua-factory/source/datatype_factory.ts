/**
 * @module node-opcua-factory
 */
import * as util from "util";
import * as chalk from "chalk";

import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { ExpandedNodeId, NodeId } from "node-opcua-nodeid";
import { DataTypeIds } from "node-opcua-constants";

import { getBuiltInType as getBuiltInType, hasBuiltInType } from "./builtin_types";
import { EnumerationDefinitionSchema, getBuiltInEnumeration, hasBuiltInEnumeration } from "./enumerations";
import {
    CommonInterface,
    StructuredTypeField,
    IStructuredTypeSchema,
    ConstructorFuncWithSchema,
    ConstructorFunc,
    IBaseUAObject
} from "./types";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

export function _findFieldSchema(typeDictionary: DataTypeFactory, field: StructuredTypeField, value: any): IStructuredTypeSchema {
    const fieldType = field.fieldType;

    if (field.allowSubType && field.category === "complex") {
        const fieldTypeConstructor = value ? value.constructor : field.fieldTypeConstructor;

        const _newFieldSchema = fieldTypeConstructor.schema;

        return _newFieldSchema as IStructuredTypeSchema;
    }

    const fieldTypeConstructor = field.fieldTypeConstructor || typeDictionary.getStructureTypeConstructor(fieldType);

    return (field.schema as IStructuredTypeSchema) || (fieldTypeConstructor as any).schema;
}

export class DataTypeFactory {
    public defaultByteOrder: string;
    public targetNamespace: string;
    public imports: string[] = [];

    private _structureTypeConstructorByNameMap: Map<string, ConstructorFuncWithSchema> = new Map();
    private _structureTypeConstructorByDataTypeMap: Map<string, ConstructorFuncWithSchema> = new Map();
    private _structureTypeConstructorByEncodingNodeIdMap: Map<string, any> = new Map();
    private _enumerations: Map<string, EnumerationDefinitionSchema> = new Map();

    private baseDataFactories: DataTypeFactory[];

    public constructor(baseDataFactories: DataTypeFactory[]) {
        this.defaultByteOrder = "LittleEndian";
        this.targetNamespace = "";
        this.baseDataFactories = baseDataFactories;
    }

    public repairBaseDataFactories(baseDataFactories: DataTypeFactory[]): void {
        this.baseDataFactories = baseDataFactories;
    }

    public hasBuiltInType(name: string): boolean {
        return hasBuiltInType(name);
    }

    public getBuiltInType(name: string): CommonInterface {
        return getBuiltInType(name);
    }

    public getBuiltInTypeByDataType(nodeId: NodeId): CommonInterface {
        return getBuiltInType(DataTypeIds[nodeId.value as number]);
    }

    // -----------------------------
    // EnumerationDefinitionSchema
    public registerEnumeration(enumeration: EnumerationDefinitionSchema): void {
        assert(!this._enumerations.has(enumeration.name), "enumeration already registered");
        this._enumerations.set(enumeration.name, enumeration);
    }

    public hasEnumeration(enumName: string): boolean {
        if (this._enumerations.has(enumName)) {
            return true;
        }
        for (const factory of this.baseDataFactories) {
            const e = factory.hasEnumeration(enumName);
            if (e) {
                return true;
            }
        }
        if (hasBuiltInEnumeration(enumName)) {
            return true;
        }
        return false;
    }

    public getEnumeration(enumName: string): EnumerationDefinitionSchema | null {
        if (this._enumerations.has(enumName)) {
            return this._enumerations.get(enumName) || null;
        }
        for (const factory of this.baseDataFactories) {
            const hasEnum = factory.hasEnumeration(enumName);
            if (hasEnum) {
                const e = factory.getEnumeration(enumName);
                return e;
            }
        }
        const ee = getBuiltInEnumeration(enumName);
        return ee;
    }
    //  ----------------------------

    public findConstructorForDataType(dataTypeNodeId: NodeId): ConstructorFuncWithSchema {
        const constructor = this.getConstructorForDataType(dataTypeNodeId);
        if (constructor) {
            return constructor;
        }
        this.getConstructorForDataType(dataTypeNodeId);
        throw new Error("Cannot find StructureType constructor for dataType " + dataTypeNodeId.toString());
    }
    public getConstructorForDataType(dataTypeNodeId: NodeId): ConstructorFuncWithSchema | null {
        const constructor = this._structureTypeConstructorByDataTypeMap.get(dataTypeNodeId.toString());
        if (constructor) {
            return constructor;
        }
        for (const factory of this.baseDataFactories) {
            const constructor2 = factory.getConstructorForDataType(dataTypeNodeId);
            if (constructor2) {
                return constructor2;
            }
        }
        return null;
    }
    // ----------------------------------------------------------------------------------------------------
    // Access by typeName
    // ----------------------------------------------------------------------------------------------------
    public structuredTypesNames(): IterableIterator<string> {
        return this._structureTypeConstructorByNameMap.keys();
    }

    public getStructureTypeConstructor(typeName: string): ConstructorFuncWithSchema {
        const constructor = this._structureTypeConstructorByNameMap.get(typeName);
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
        // istanbul ignore next
        if (doDebug) {
            console.log([...this.structuredTypesNames()].join(" "));
        }
        // istanbul ignore next
        throw new Error(
            "Cannot find StructureType constructor for " + typeName + " - it may be abstract, or it could be a basic type"
        );
    }

    public hasStructuredType(typeName: string): boolean {
        if (this._structureTypeConstructorByNameMap.has(typeName)) {
            return true;
        }
        for (const factory of this.baseDataFactories) {
            if (factory.hasStructuredType(typeName)) {
                return true;
            }
        }
        return false;
    }

    public getStructuredTypeSchema(typeName: string): IStructuredTypeSchema {
        const constructor = this.getStructureTypeConstructor(typeName);
        return constructor.schema;
    }

    // istanbul ignore next
    public dump(): void {
        console.log(" dumping registered factories");
        console.log(
            " Factory ",
            [...this.structuredTypesNames()].sort().forEach((e) => e)
        );
        console.log(" done");
    }

    public registerClassDefinition(dataTypeNodeId: NodeId, className: string, classConstructor: ConstructorFuncWithSchema): void {
        this._registerFactory(dataTypeNodeId, className, classConstructor);
        if (classConstructor.encodingDefaultBinary && classConstructor.encodingDefaultBinary.value !== 0) {
            this.associateWithBinaryEncoding(className, classConstructor.encodingDefaultBinary);
        } else {
            // for instance in DI FetchResultDataType should be abstract but is not
            debugLog("warning ", dataTypeNodeId.toString(), "name=", className, " do not have binary encoding");
        }
    }

    // ----------------------------------------------------------------------------------------------------
    // Access by binaryEncodingNodeId
    // ----------------------------------------------------------------------------------------------------
    public getConstructor(binaryEncodingNodeId: NodeId): ConstructorFunc | null {
        const expandedNodeIdKey = makeExpandedNodeIdKey(binaryEncodingNodeId);
        const constructor = this._structureTypeConstructorByEncodingNodeIdMap.get(expandedNodeIdKey);
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
        const constructor = this._structureTypeConstructorByEncodingNodeIdMap.get(expandedNodeIdKey);
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

    public constructObject(binaryEncodingNodeId: NodeId): IBaseUAObject {
        if (!verifyExpandedNodeId(binaryEncodingNodeId)) {
            throw new Error(" constructObject : invalid expandedNodeId provided " + binaryEncodingNodeId.toString());
        }
        const constructor = this.getConstructor(binaryEncodingNodeId);

        if (!constructor) {
            debugLog("Cannot find constructor for " + binaryEncodingNodeId.toString());
            throw new Error("Cannot find constructor for " + binaryEncodingNodeId.toString());
        }
        return new constructor();
    }

    public associateWithBinaryEncoding(className: string, expandedNodeId: ExpandedNodeId): void {
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
        if (this._structureTypeConstructorByEncodingNodeIdMap.has(expandedNodeIdKey)) {
            throw new Error(
                " Class " +
                    className +
                    " with ID " +
                    expandedNodeId +
                    "  already in constructorMap for  " +
                    this._structureTypeConstructorByEncodingNodeIdMap.get(expandedNodeIdKey).name
            );
        }

        this._structureTypeConstructorByEncodingNodeIdMap.set(expandedNodeIdKey, classConstructor);
    }

    public toString(): string {
        const l: string[] = [];
        function write(...args: [any, ...any[]]) {
            l.push(util.format.apply(util.format, args));
        }
        dumpDataFactory(this, write);
        return l.join("\n");
    }

    private _registerFactory(dataTypeNodeId: NodeId, typeName: string, constructor: ConstructorFuncWithSchema): void {
        /* istanbul ignore next */
        if (this.hasStructuredType(typeName)) {
            console.log(this.getStructureTypeConstructor(typeName));
            console.log("target namespace =", this.targetNamespace);
            throw new Error(" registerFactory  : " + typeName + " already registered");
        }
        debugLog("registering typeName ", typeName, dataTypeNodeId.toString());
        this._structureTypeConstructorByNameMap.set(typeName, constructor);
        if (dataTypeNodeId.value !== 0) {
            this._structureTypeConstructorByDataTypeMap.set(dataTypeNodeId.toString(), constructor);
        }
        Object.defineProperty(constructor.schema, "$$factory", {
            enumerable: false,
            value: this,
            writable: false
        });
    }
}

function dumpSchema(schema: IStructuredTypeSchema, write: any) {
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

        write("structureTypeName =", structureTypeName);

        if (!dataFactory.getConstructorForDataType(schema.dataTypeNodeId)) {
            write("  ( No constructor for " + schema.name + "  " + schema.dataTypeNodeId.toString());
        }
        if (!schema.encodingDefaultBinary) {
            write(" (Schema has no encoding defaultBinary )");
        } else {
            if (dataFactory.hasConstructor(schema.encodingDefaultBinary)) {
                console.log("schema", schema.name);
                console.log("schema", schema.dataTypeNodeId.toString());
                console.log("schema", schema.encodingDefaultBinary ? schema.encodingDefaultBinary.toString() : " ");
                console.log("schema", schema.encodingDefaultXml ? schema.encodingDefaultXml.toString() : " ");
                // return;
                // throw new Error("Not  in Binary Encoding Map!!!!!  " + schema.encodingDefaultBinary);
            }
        }
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
