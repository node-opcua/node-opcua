import type { QualifiedNameLike, QualifiedNameOptions } from "node-opcua-data-model";
import type { NodeId, NodeIdLike } from "node-opcua-nodeid";
import type { NodeClass } from "node-opcua-types";
import type { BaseNode, BaseNodeEvents, IPropertyAndComponentHolder } from "./base_node.js";
import type { EventNotifierFlags } from "./event_notifier_flags.js";
import type { InstantiateOptions } from "./instantiate_options.js";
import type { UAMethod } from "./ua_method.js";
import type { UAObject } from "./ua_object.js";

export interface InstantiateObjectOptions extends InstantiateOptions {
    //
    conditionSource?: NodeId | BaseNode | null;
    eventNotifier?: EventNotifierFlags;
    // for DataTypeEncodingType
    encodingOf?: NodeId | BaseNode;

    /**
     * note
     *  - when addInOf  is specified, organizedBy nor componentOf must not be defined
     */
    addInOf?: NodeId | BaseNode;
}

export declare interface UAObjectType extends BaseNode<BaseNodeEvents>, IPropertyAndComponentHolder {
    readonly nodeClass: NodeClass.ObjectType;
    readonly subtypeOf: NodeId | null;
    readonly subtypeOfObj: UAObjectType | null;

    readonly isAbstract: boolean;
    readonly hasMethods: boolean;

    isSubtypeOf(referenceType: NodeIdLike | UAObjectType): boolean;

    /** @deprecated - use isSubtypeOf instead */
    isSupertypeOf(referenceType: NodeIdLike | UAObjectType): boolean;

    instantiate(options: InstantiateObjectOptions): UAObject;

    // Method accessor
    getMethodById(nodeId: NodeId): UAMethod | null;

    getMethodByName(methodName: QualifiedNameOptions): UAMethod | null;
    getMethodByName(methodName: string, namespaceIndex?: number): UAMethod | null;
    getMethodByName(methodName: QualifiedNameLike, namespaceIndex?: number): UAMethod | null;

    getMethods(): UAMethod[];
}
