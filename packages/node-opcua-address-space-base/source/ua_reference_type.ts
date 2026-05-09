import type { LocalizedText, NodeClass } from "node-opcua-data-model";
import type { NodeId, NodeIdLike } from "node-opcua-nodeid";
import type { BaseNode } from "./base_node";
import type { UAReference } from "./ua_reference";

export interface UAReferenceType extends BaseNode {
    readonly nodeClass: NodeClass.ReferenceType;
    readonly subtypeOfObj: UAReferenceType | null;
    readonly subtypeOf: NodeId | null;
    readonly isAbstract: boolean;
    readonly inverseName: LocalizedText;

    isSubtypeOf(baseType: UAReferenceType | NodeIdLike): boolean;

    /** @deprecated - use  isSubtypeOf instead */
    isSupertypeOf(baseType: UAReferenceType | NodeIdLike): boolean;

    getAllSubtypes(): UAReferenceType[];

    /**
     *
     * @param reference
     */
    checkHasSubtype(referenceType: NodeId | UAReference): boolean;
}
