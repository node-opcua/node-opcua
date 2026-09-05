/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */

import type { BaseNode, ListenerSignature, UAProperty } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import type { UAString, UInt16 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import type { DTTimeZone } from "node-opcua-nodeset-ua";
import { DataType, Variant } from "node-opcua-variant";
import type { UABaseEventEvents, UABaseEventEx } from "../../api/interfaces/alarms_and_conditions/ua_base_event_ex.js";
import { BaseNodeImpl } from "../base_node_impl.js";
import { UAObjectImpl } from "../ua_object_impl.js";

export type { UABaseEventEvents, UABaseEventEx } from "../../api/interfaces/alarms_and_conditions/ua_base_event_ex.js";

export class UABaseEventImplBase<T extends UABaseEventEvents & ListenerSignature<T> = UABaseEventEvents>
    extends UAObjectImpl<T>
    implements UABaseEventEx
{
    /**
     * The event's properties, installed as child nodes by the address space rather than
     * assigned by this constructor - hence `declare`, which emits nothing. Subclasses inherit
     * these, so the condition and alarm implementations get them too.
     */
    declare public readonly eventId: UAProperty<Buffer, DataType.ByteString>;
    declare public readonly eventType: UAProperty<NodeId, DataType.NodeId>;
    declare public readonly sourceNode: UAProperty<NodeId, DataType.NodeId>;
    declare public readonly sourceName: UAProperty<UAString, DataType.String>;
    declare public readonly time: UAProperty<Date, DataType.DateTime>;
    declare public readonly receiveTime: UAProperty<Date, DataType.DateTime>;
    declare public readonly localTime?: UAProperty<DTTimeZone, DataType.ExtensionObject>;
    declare public readonly message: UAProperty<LocalizedText, DataType.LocalizedText>;
    declare public readonly severity: UAProperty<UInt16, DataType.UInt16>;

    /**
     */
    public setSourceName(name: string): void {
        assert(typeof name === "string");
        this.sourceName.setValueFromSource(
            new Variant({
                dataType: DataType.String,
                value: name
            })
        );
    }
    /**
     */
    public setSourceNode(node: NodeId | BaseNode): void {
        this.sourceNode.setValueFromSource(
            new Variant({
                dataType: DataType.NodeId,
                value: node instanceof BaseNodeImpl ? node.nodeId : node
            })
        );
    }
}

export type UABaseEventImpl = UABaseEventImplBase;
export const UABaseEventImpl = UABaseEventImplBase;
