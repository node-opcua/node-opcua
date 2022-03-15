import { LocalizedText, NodeClass } from "node-opcua-data-model";
import { NodeId, NodeIdLike } from "node-opcua-nodeid";
import { BaseNode } from "./base_node";
import { UAReference } from "./ua_reference";

export declare class UAReferenceType extends BaseNode {
    public readonly nodeClass: NodeClass.ReferenceType;
    public readonly subtypeOfObj: UAReferenceType | null;
    public readonly subtypeOf: NodeId | null;
    public readonly isAbstract: boolean;
    public readonly inverseName: LocalizedText;

    public isSupertypeOf(baseType: UAReferenceType | NodeIdLike): boolean;

    public getAllSubtypes(): UAReferenceType[];

    /**
     *
     * @param reference
     */
    public checkHasSubtype(referenceType: NodeId | UAReference): boolean;
}
