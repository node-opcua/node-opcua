/**
 * @module node-opcua-factory
 */
// tslint:disable:no-console
import * as chalk from "chalk";
import * as  _ from "underscore";

import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { ExpandedNodeId, NodeId } from "node-opcua-nodeid";

import { ConstructorFunc, ConstructorFuncWithSchema } from "./constructor_type";
import { BaseUAObject } from "./factories_baseobject";
import { EnumerationDefinitionSchema } from "./factories_enumerations";
import { StructuredTypeSchema } from "./factories_structuredTypeSchema";

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

    private readonly baseDataFactories: DataTypeFactory[];

    public constructor(baseDataFactories: DataTypeFactory[]) {
        this.defaultByteOrder = "LittleEndian";
        this.targetNamespace = "";
        this.baseDataFactories = baseDataFactories;
    }

    // -----------------------------
    // EnumerationDefinitionSchema
    public registerEnumeration(enumeration: EnumerationDefinitionSchema): void {
        assert(!this._enumerations[enumeration.name]);
        this._enumerations[enumeration.name] = enumeration;
    }
    public hasEnumeration(enumName: string): boolean {
        return this.getEnumeration(enumName) !== null;
    }
    public getEnumeration(enumName: string): EnumerationDefinitionSchema | null {
        if (this._enumerations[enumName]) {
            return this._enumerations[enumName];
        }
        return null;
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
            const constructor2 = factory.getStructureTypeConstructor(typeName);
            if (constructor2) {
                return constructor2;
            }
        }
        throw new Error("Cannot find StructureType constructor for " + typeName + " - it may be abstract");
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
        this.registerFactory(dataTypeNodeId, className, classConstructor);
        assert(classConstructor.encodingDefaultBinary.value !== 0);
        this.associateWithBinaryEncoding(className, classConstructor.encodingDefaultBinary);
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

    public registerFactory(dataTypeNodeId: NodeId, typeName: string, constructor: ConstructorFuncWithSchema): void {
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

