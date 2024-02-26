/**
 * @module node-opcua-factory
 */
import util from "util";
import chalk from "chalk";

import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog, make_warningLog } from "node-opcua-debug";
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
const warningLog = make_warningLog(__filename);

export interface StructureInfo {
    constructor: ConstructorFuncWithSchema | null; // null if abstract
    schema: IStructuredTypeSchema;
}
export class DataTypeFactory {
    public defaultByteOrder: string;
    public targetNamespace: string;
    public imports: string[] = [];

    private _structureInfoByName: Map<string, StructureInfo> = new Map();
    private _structureInfoByDataTypeMap: Map<string, StructureInfo> = new Map();

    private _structureInfoByEncodingMap: Map<string, StructureInfo> = new Map();
    private _enumerations: Map<string, EnumerationDefinitionSchema> = new Map();

    private baseDataFactories: DataTypeFactory[];

    public constructor(baseDataFactories: DataTypeFactory[]) {
        this.defaultByteOrder = "LittleEndian";
        this.targetNamespace = "";
        this.baseDataFactories = baseDataFactories;
    }

    public getStructureIterator(): IterableIterator<StructureInfo> {
        return this._structureInfoByDataTypeMap.values();
    }
    public getEnumIterator(): IterableIterator<EnumerationDefinitionSchema> {
        return this._enumerations.values();
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

    public findStructureInfoForDataType(dataTypeNodeId: NodeId): StructureInfo {
        const structureInfo = this.getStructureInfoForDataType(dataTypeNodeId);
        if (structureInfo) {
            return structureInfo;
        }
        this.getStructureInfoForDataType(dataTypeNodeId);
        throw new Error("Cannot find StructureType constructor for dataType " + dataTypeNodeId.toString());
    }
    public getStructureInfoForDataType(dataTypeNodeId: NodeId): StructureInfo | null {
        const structureInfo = this._structureInfoByDataTypeMap.get(dataTypeNodeId.toString());
        if (structureInfo) {
            return structureInfo;
        }
        for (const factory of this.baseDataFactories) {
            const structureInfo2 = factory.getStructureInfoForDataType(dataTypeNodeId);
            if (structureInfo2) {
                return structureInfo2;
            }
        }
        return null;
    }
    // ----------------------------------------------------------------------------------------------------
    // Access by typeName
    // ----------------------------------------------------------------------------------------------------
    public structuredTypesNames(): IterableIterator<string> {
        return this._structureInfoByName.keys();
    }
    public enumerations(): IterableIterator<string> {
        return this._enumerations.keys();
    }

    public getStructureInfoByTypeName(typeName: string): StructureInfo {
        const structureInfo = this._structureInfoByName.get(typeName);
        if (structureInfo) {
            return structureInfo;
        }
        for (const factory of this.baseDataFactories) {
            if (!factory.hasStructureByTypeName(typeName)) {
                continue;
            }
            const structureInfo2 = factory.getStructureInfoByTypeName(typeName);
            if (structureInfo2) {
                return structureInfo2;
            }
        }
        // istanbul ignore next
        if (doDebug) {
            debugLog([...this.structuredTypesNames()].join(" "));
        }
        // istanbul ignore next
        throw new Error(
            "Cannot find StructureType constructor for " + typeName + " - it may be abstract, or it could be a basic type"
        );
    }

    public hasStructureByTypeName(typeName: string): boolean {
        if (this._structureInfoByName.has(typeName)) {
            return true;
        }
        for (const factory of this.baseDataFactories) {
            if (factory.hasStructureByTypeName(typeName)) {
                return true;
            }
        }
        return false;
    }

    public getStructuredTypeSchema(typeName: string): IStructuredTypeSchema {
        const structureInfo = this.getStructureInfoByTypeName(typeName);
        return structureInfo.schema;
    }

    // istanbul ignore next
    public dump(): void {
        warningLog(" dumping registered factories");
        warningLog(
            " Factory ",
            [...this.structuredTypesNames()].sort().forEach((e) => e)
        );
        warningLog(" done");
    }

    public registerAbstractStructure(dataTypeNodeId: NodeId, className: string, schema: IStructuredTypeSchema) {
        schema.isAbstract = true;
        this._registerFactory(dataTypeNodeId, className, null, schema);
    }

    public registerClassDefinition(dataTypeNodeId: NodeId, className: string, classConstructor: ConstructorFuncWithSchema): void {
        this._registerFactory(dataTypeNodeId, className, classConstructor, classConstructor.schema);

        if (classConstructor.schema.isAbstract) {
            return;
        }
        
        if (classConstructor.encodingDefaultBinary && classConstructor.encodingDefaultBinary.value !== 0) {
            this.associateWithBinaryEncoding(className, classConstructor.encodingDefaultBinary);
        } else {
            // for instance in DI FetchResultDataType should be abstract but is not
            warningLog("warning ", dataTypeNodeId.toString(), "name=", className, " does not have binary encoding");
        }
    }

    // ----------------------------------------------------------------------------------------------------
    // Access by binaryEncodingNodeId
    // ----------------------------------------------------------------------------------------------------
    public getConstructor(binaryEncodingNodeId: NodeId): ConstructorFunc | null {
        const expandedNodeIdKey = makeExpandedNodeIdKey(binaryEncodingNodeId);
        const structureInfo = this._structureInfoByEncodingMap.get(expandedNodeIdKey);
        if (!structureInfo) return null;
        const Constructor = structureInfo.constructor;
        if (Constructor) {
            return Constructor;
        }
        for (const factory of this.baseDataFactories) {
            const Constructor2 = factory.getConstructor(binaryEncodingNodeId);
            if (Constructor2) {
                return Constructor2;
            }
        }
        debugLog(chalk.red("#getConstructor : cannot find constructor for expandedId "), binaryEncodingNodeId.toString());
        return null;
    }

    public hasConstructor(binaryEncodingNodeId: NodeId): boolean {
        if (!binaryEncodingNodeId) {
            return false;
        }
        verifyExpandedNodeId(binaryEncodingNodeId);

        const expandedNodeIdKey = makeExpandedNodeIdKey(binaryEncodingNodeId);
        const constructor = this._structureInfoByEncodingMap.get(expandedNodeIdKey);
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
        verifyExpandedNodeId(binaryEncodingNodeId);

        const Constructor = this.getConstructor(binaryEncodingNodeId);

        if (!Constructor) {
            debugLog("Cannot find constructor for " + binaryEncodingNodeId.toString());
            throw new Error("Cannot find constructor for " + binaryEncodingNodeId.toString());
        }
        return new Constructor();
    }

    public associateWithBinaryEncoding(className: string, expandedNodeId: ExpandedNodeId): void {
        const structureInfo = this.getStructureInfoByTypeName(className);
        // if (doDebug) {
        //     debugLog(" associateWithBinaryEncoding ", className, expandedNodeId.toString());
        // }

        verifyExpandedNodeId(expandedNodeId);

        const expandedNodeIdKey = makeExpandedNodeIdKey(expandedNodeId);

        /* istanbul ignore next */
        if (this._structureInfoByEncodingMap.has(expandedNodeIdKey)) {
            throw new Error(
                " Class " +
                    className +
                    " with ID " +
                    expandedNodeId +
                    "  already in constructorMap for  " +
                    this._structureInfoByEncodingMap.get(expandedNodeIdKey)!.schema.name
            );
        }

        this._structureInfoByEncodingMap.set(expandedNodeIdKey, structureInfo);
    }

    public toString(): string {
        const l: string[] = [];
        function write(...args: [any, ...any[]]) {
            l.push(util.format.apply(util.format, args));
        }
        dumpDataFactory(this, write);
        return l.join("\n");
    }

    private _registerFactory(
        dataTypeNodeId: NodeId,
        typeName: string,
        constructor: ConstructorFuncWithSchema | null,
        schema: IStructuredTypeSchema
    ): void {
        /* istanbul ignore next */
        if (this._structureInfoByName.has(typeName)) {
            warningLog("target namespace = `" + this.targetNamespace + "`");
            warningLog("registerFactory  : " + typeName + " already registered. dataTypeNodeId=", dataTypeNodeId.toString());
            return;
        }
        debugLog("registering typeName ", typeName, dataTypeNodeId.toString(), "isAbstract ", schema.isAbstract);
        const structureInfo = { constructor, schema };
        this._structureInfoByName.set(typeName, structureInfo);
        if (dataTypeNodeId.value !== 0) {
            this._structureInfoByDataTypeMap.set(dataTypeNodeId.toString(), structureInfo);
        }
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
function dumpDataFactory(dataFactory: DataTypeFactory, write: (...args: [any, ...any[]]) => void) {
    for (const structureTypeName of dataFactory.structuredTypesNames()) {
        const schema = dataFactory.getStructuredTypeSchema(structureTypeName);

        write("structureTypeName =", structureTypeName);

        if (!dataFactory.getStructureInfoForDataType(schema.dataTypeNodeId)) {
            write("  ( No constructor for " + schema.name + "  " + schema.dataTypeNodeId.toString());
        }
        if (!schema.encodingDefaultBinary) {
            write(" (Schema has no encoding defaultBinary )");
        } else {
            if (dataFactory.hasConstructor(schema.encodingDefaultBinary)) {
                write("ERROR: cannot find constructor for encodingDefaultBinary");
                write("schema             name:", schema.name, "(abstract=", schema.isAbstract, ")");
                write("        dataType NodeId:", schema.dataTypeNodeId.toString());
                write("encoding Default Binary:", schema.encodingDefaultBinary ? schema.encodingDefaultBinary.toString() : " ");
                write("encoding Default Xml   :", schema.encodingDefaultXml ? schema.encodingDefaultXml.toString() : " ");
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
