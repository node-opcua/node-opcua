/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */

import type { BaseNode, ListenerSignature } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import type { NodeId } from "node-opcua-nodeid";
import { DataType, Variant } from "node-opcua-variant";
import type { UABaseEventEvents, UABaseEventEx } from "../../source/interfaces/alarms_and_conditions/ua_base_event_ex";
import { BaseNodeImpl } from "../base_node_impl";
import { UAObjectImpl } from "../ua_object_impl";

export type { UABaseEventEvents, UABaseEventEx } from "../../source/interfaces/alarms_and_conditions/ua_base_event_ex";

const $ = (a: UABaseEventImplBase): UABaseEventEx => a as unknown as UABaseEventEx;

export class UABaseEventImplBase<T extends UABaseEventEvents & ListenerSignature<T> = UABaseEventEvents> extends UAObjectImpl<T> {
    /**
     */
    public setSourceName(name: string): void {
        assert(typeof name === "string");
        $(this).sourceName.setValueFromSource(
            new Variant({
                dataType: DataType.String,
                value: name
            })
        );
    }
    /**
     */
    public setSourceNode(node: NodeId | BaseNode): void {
        $(this).sourceNode.setValueFromSource(
            new Variant({
                dataType: DataType.NodeId,
                value: node instanceof BaseNodeImpl ? node.nodeId : node
            })
        );
    }
}

export type UABaseEventImpl = UABaseEventImplBase & UABaseEventEx;
export const UABaseEventImpl = UABaseEventImplBase as unknown as new () => UABaseEventImpl;