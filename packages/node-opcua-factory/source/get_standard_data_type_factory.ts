/**
 * @module node-opcua-factory
 */
import { ExpandedNodeId, NodeId } from "node-opcua-nodeid";

import { DataTypeFactory } from "./datatype_factory";

import { ConstructorFunc, ConstructorFuncWithSchema } from "./types";

let globalFactory: DataTypeFactory;

export function getStandardDataTypeFactory(): DataTypeFactory {
    if (!globalFactory) {
        globalFactory = new DataTypeFactory([]);
        globalFactory.targetNamespace = "http://opcfoundation.org/UA/";
    }
    return globalFactory;
}

export function getStructureTypeConstructor(typeName: string): ConstructorFuncWithSchema {
    const structureInfo =  getStandardDataTypeFactory().getStructureInfoByTypeName(typeName);
    if (!structureInfo) {
        throw new Error("cannot find Structure Information for "+ typeName)
    }
    if (!structureInfo.constructor) {
        throw new Error("cannot  Structure is Abstract ! "+ typeName)
    }
    return structureInfo.constructor;
}



/* istanbul ignore next */
export function dump(): void {
    getStandardDataTypeFactory().dump();
}
