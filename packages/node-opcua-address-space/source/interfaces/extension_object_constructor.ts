import type { ExtensionObject } from "node-opcua-extension-object";
import type { IStructuredTypeSchema } from "node-opcua-factory";
import type { ExpandedNodeId } from "node-opcua-nodeid";

export type ExtensionObjectConstructor = new (options?: Record<string, unknown>) => ExtensionObject;
export interface ExtensionObjectConstructorFuncWithSchema extends ExtensionObjectConstructor {
    schema: IStructuredTypeSchema;
    possibleFields: string[];
    encodingDefaultBinary: ExpandedNodeId;
    encodingDefaultXml: ExpandedNodeId;
}
