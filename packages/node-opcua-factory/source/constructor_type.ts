/**
 * @module node-opcua-factory
 */
import { ExpandedNodeId } from "node-opcua-nodeid";

import { BaseUAObject } from "./factories_baseobject";
import { StructuredTypeSchema } from "./factories_structuredTypeSchema";

type BaseUAObjectConstructable = new (options?: any) => BaseUAObject;
export type ConstructorFunc = BaseUAObjectConstructable;
// new (...args: any[]) => BaseUAObjectConstructable;

export interface ConstructorFuncWithSchema extends ConstructorFunc {
    schema: StructuredTypeSchema;
    possibleFields: string[];
    encodingDefaultBinary: ExpandedNodeId;
    encodingDefaultXml: ExpandedNodeId;
}
