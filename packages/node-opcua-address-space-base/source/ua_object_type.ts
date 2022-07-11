import { QualifiedNameLike, QualifiedNameOptions } from "node-opcua-data-model";
import { NodeClass } from "node-opcua-types";
import { NodeId, NodeIdLike } from "node-opcua-nodeid";
import { Byte } from "node-opcua-basic-types";

import { InstantiateOptions } from "./instantiate_options";
import { BaseNode, IPropertyAndComponentHolder } from "./base_node";
import { UAObject } from "./ua_object";
import { UAMethod } from "./ua_method";

export interface InstantiateObjectOptions extends InstantiateOptions {
    //
    conditionSource?: NodeId | BaseNode | null;
    eventNotifier?: Byte;
    // for DataTypeEncodingType
    encodingOf?: NodeId | BaseNode;
}

export declare interface UAObjectType extends BaseNode, IPropertyAndComponentHolder {
    readonly nodeClass: NodeClass.ObjectType;
    readonly subtypeOf: NodeId | null;
    readonly subtypeOfObj: UAObjectType | null;

    readonly isAbstract: boolean;
    readonly hasMethods: boolean;

    isSupertypeOf(referenceType: NodeIdLike | UAObjectType): boolean;

    instantiate(options: InstantiateObjectOptions): UAObject;

    // Method accessor
    getMethodById(nodeId: NodeId): UAMethod | null;

    getMethodByName(methodName: QualifiedNameOptions): UAMethod | null;
    getMethodByName(methodName: string, namespaceIndex?: number): UAMethod | null;
    getMethodByName(methodName: QualifiedNameLike, namespaceIndex?: number): UAMethod | null;

    getMethods(): UAMethod[];
}
