// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt16, UAString } from "node-opcua-basic-types"
import { DTTimeZone } from "./dt_time_zone"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |BaseEventType ns=0;i=2041                         |
 * |isAbstract      |true                                              |
 */
export interface UABaseEvent_Base {
    eventId: UAProperty<Buffer, /*z*/DataType.ByteString>;
    eventType: UAProperty<NodeId, /*z*/DataType.NodeId>;
    sourceNode: UAProperty<NodeId, /*z*/DataType.NodeId>;
    sourceName: UAProperty<UAString, /*z*/DataType.String>;
    time: UAProperty<Date, /*z*/DataType.DateTime>;
    receiveTime: UAProperty<Date, /*z*/DataType.DateTime>;
    localTime?: UAProperty<DTTimeZone, /*z*/DataType.ExtensionObject>;
    message: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
    severity: UAProperty<UInt16, /*z*/DataType.UInt16>;
}
export interface UABaseEvent extends UAObject, UABaseEvent_Base {
}