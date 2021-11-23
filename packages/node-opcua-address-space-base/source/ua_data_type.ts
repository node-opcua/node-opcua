import { NodeClass } from "node-opcua-data-model";
import { ExpandedNodeId, NodeId, NodeIdLike } from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";
import { DataTypeDefinition, EnumDefinition, StructureDefinition } from "node-opcua-types";

import { BaseNode } from "./base_node";

export interface UADataType extends BaseNode {
    readonly nodeClass: NodeClass.DataType;

    readonly subtypeOfObj: UADataType | null;
    readonly subtypeOf: NodeId | null;

    readonly isAbstract: boolean;

    readonly binaryEncodingDefinition: string | null;
    readonly binaryEncodingNodeId: ExpandedNodeId | null;
    readonly binaryEncoding: BaseNode | null;

    readonly xmlEncodingDefinition: string | null;
    readonly xmlEncodingNodeId: ExpandedNodeId | null;
    readonly xmlEncoding: BaseNode | null;

    // readonly jsonEncodingDefinition: string | null;
    readonly jsonEncodingNodeId: ExpandedNodeId | null;
    readonly jsonEncoding: BaseNode | null;

    readonly basicDataType: DataType;
    readonly symbolicName: string;

    isSupertypeOf(referenceType: NodeIdLike | UADataType): boolean;

    getEncodingNode(encodingName: string): BaseNode | null;

    /**
     *
     */
    getDefinition(): DataTypeDefinition;

    isStructure(): boolean;
    getStructureDefinition(): StructureDefinition;
    
    isEnumeration(): boolean; 
    getEnumDefinition(): EnumDefinition;

    getBasicDataType(): DataType;
}
