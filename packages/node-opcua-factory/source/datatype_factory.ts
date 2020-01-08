/**
 * @module node-opcua-factory
 */
// tslint:disable:no-console
import * as chalk from "chalk";
import * as  _ from "underscore";

import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import {ExpandedNodeId, NodeId} from "node-opcua-nodeid";

import { ConstructorFunc, ConstructorFuncWithSchema } from "./constructor_type";
import { BaseUAObject } from "./factories_baseobject";
import { StructuredTypeSchema } from "./factories_structuredTypeSchema";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

export class DataTypeFactory {

    public defaultByteOrder: string;
    public targetNamespace: string;
    public imports: string[] = [];

    private _structureTypeConstructorByNameMap: { [key: string]: ConstructorFuncWithSchema } = {};
    private _structureTypeConstructorByEncodingNodeIdMap: any = {};
    private readonly baseDataFactories: DataTypeFactory[];

    public constructor(baseDataFactories: DataTypeFactory[]) {
        this.defaultByteOrder = "LittleEndian";
        this.targetNamespace = "";
        this.baseDataFactories = baseDataFactories;
    }

    public registerFactory(typeName: string, constructor: ConstructorFuncWithSchema): void {
        /* istanbul ignore next */
        if (this.hasStructuredType(typeName)) {
            console.log(this.getStructureTypeConstructor(typeName));
            console.log("target namespace =", this.targetNamespace);
            throw new Error(" registerFactory  : " + typeName + " already registered");
        }
        this._structureTypeConstructorByNameMap[typeName] = constructor;
        Object.defineProperty(constructor.schema, "$typeDictionary", {
            enumerable: false,
            value: this,
            writable: false,
        });

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
        throw new Error("Cannot find StructureType constructor for " + typeName);
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

    public registerClassDefinition(className: string, classConstructor: ConstructorFuncWithSchema): void {
        this.registerFactory(className, classConstructor);
        const expandedNodeId = classConstructor.encodingDefaultBinary;
        this.associateWithBinaryEncoding(className, expandedNodeId);
    }

    public associateWithDataType(className: string, nodeId: NodeId) {

        return;
        /*
        const schema = this.structuredTypes[className];
        if (doDebug) {
            debugLog(" associateWithDataType ", className, nodeId.toString());
        }
        assert(schema.id.toString() === "ns=0;i=0", "already associated");
        schema.id = nodeId;
         */
    }

    public associateWithBinaryEncoding(className: string, expandedNodeId: ExpandedNodeId) {
        const classConstructor = this.getStructureTypeConstructor(className);
        if (doDebug) {
            debugLog(" associateWithBinaryEncoding ", className, expandedNodeId.toString());
        }

        /* istanbul ignore next */
        if (!verifyExpandedNodeId(expandedNodeId)) {
            console.log()
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

    public getConstructor(expandedNodeId: ExpandedNodeId): ConstructorFunc | null {
        const expandedNodeIdKey = makeExpandedNodeIdKey(expandedNodeId);
        const constructor = this._structureTypeConstructorByEncodingNodeIdMap[expandedNodeIdKey];
        if (constructor) {
            return constructor;
        }
        for (const factory of this.baseDataFactories) {
            const constructor2 = factory.getConstructor(expandedNodeId);
            if (constructor2) {
                return constructor2;
            }
        }
        debugLog(chalk.red("#getConstructor : cannot find constructor for expandedId "), expandedNodeId.toString());
        return null;
    }

    public hasConstructor(expandedNodeId: ExpandedNodeId): boolean {
        if (!expandedNodeId) {
            return false;
        }
        /* istanbul ignore next */
        if (!verifyExpandedNodeId(expandedNodeId)) {
            console.log("Invalid expandedNodeId");
            return false;
        }
        const expandedNodeIdKey = makeExpandedNodeIdKey(expandedNodeId);
        const constructor = this._structureTypeConstructorByEncodingNodeIdMap[expandedNodeIdKey];
        if (constructor) {
            return true;
        }
        for (const factory of this.baseDataFactories) {
            const constructor2 = factory.getConstructor(expandedNodeId);
            if (constructor2) {
                return true;
            }
        }
        return false;
    }

    public constructObject(expandedNodeId: ExpandedNodeId): BaseUAObject {
        if (!verifyExpandedNodeId(expandedNodeId)) {
            throw new Error(" constructObject : invalid expandedNodeId provided " + expandedNodeId.toString());
        }
        const constructor = this.getConstructor(expandedNodeId);

        if (!constructor) {
            debugLog("Cannot find constructor for " + expandedNodeId.toString());
            return new BaseUAObject();
            // throw new Error("Cannot find constructor for " + expandedNodeId.toString());
        }
        return callConstructor(constructor);

    }
}

function verifyExpandedNodeId(expandedNodeId: ExpandedNodeId): boolean {
    /* istanbul ignore next */
    if (expandedNodeId.value instanceof Buffer) {
        throw new Error("getConstructor not implemented for opaque nodeid");
    }
    if (expandedNodeId.namespace === 0) {
        if (expandedNodeId.namespaceUri === "http://opcfoundation.org/UA/" || !expandedNodeId.namespaceUri) {
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

export function callConstructor(constructor: ConstructorFunc): BaseUAObject {
    assert(_.isFunction(constructor));
    const constructorFunc: any = constructor.bind.apply(constructor, arguments as any);
    return new constructorFunc();
}


