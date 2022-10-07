import { ExtensionObject } from "node-opcua-extension-object";
import { IStructuredTypeSchema } from "node-opcua-factory";
import { ExpandedNodeId } from "node-opcua-nodeid";

export type ExtensionObjectConstructor = new (options: any) => ExtensionObject;
export interface ExtensionObjectConstructorFuncWithSchema extends ExtensionObjectConstructor {
    schema: IStructuredTypeSchema;
    possibleFields: string[];
    encodingDefaultBinary: ExpandedNodeId;
    encodingDefaultXml: ExpandedNodeId;
}

