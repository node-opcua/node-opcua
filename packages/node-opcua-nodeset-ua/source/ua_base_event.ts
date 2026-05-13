import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString, UInt16 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { DTTimeZone } from "./dt_time_zone";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |BaseEventType i=2041                                        |
 * |isAbstract      |true                                                        |
 */
export interface UABaseEvent_Base {
    eventId: UAProperty<Buffer, DataType.ByteString>;
    eventType: UAProperty<NodeId, DataType.NodeId>;
    sourceNode: UAProperty<NodeId, DataType.NodeId>;
    sourceName: UAProperty<UAString, DataType.String>;
    time: UAProperty<Date, DataType.DateTime>;
    receiveTime: UAProperty<Date, DataType.DateTime>;
    localTime?: UAProperty<DTTimeZone, DataType.ExtensionObject>;
    message: UAProperty<LocalizedText, DataType.LocalizedText>;
    severity: UAProperty<UInt16, DataType.UInt16>;
    conditionClassId?: UAProperty<NodeId, DataType.NodeId>;
    conditionClassName?: UAProperty<LocalizedText, DataType.LocalizedText>;
    conditionSubClassId?: UAProperty<NodeId[], DataType.NodeId>;
    conditionSubClassName?: UAProperty<LocalizedText[], DataType.LocalizedText>;
}
export interface UABaseEvent extends UAObject, UABaseEvent_Base {}