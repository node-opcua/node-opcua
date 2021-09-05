import { NodeId } from "node-opcua-nodeid";
import { SimpleAttributeOperand } from "node-opcua-types";
import { Variant, VariantLike } from "node-opcua-variant";

import { BaseNode } from "./base_node";
import { ISessionContext } from "./session_context";
import { UAObjectType } from "./ua_object_type";

// tslint:disable:no-empty-interface
export interface UAEventType extends UAObjectType {}

export interface IEventData {
    /**
     * the event type node
     */
    $eventDataSource?: BaseNode;
    /**
     *
     */
    eventId: NodeId;

    resolveSelectClause(selectClause: SimpleAttributeOperand): NodeId | null;
    setValue(lowerName: string, node: BaseNode, variant: VariantLike): void;
    readValue(sessionContext: ISessionContext, nodeId: NodeId, selectClause: SimpleAttributeOperand): Variant;
}
