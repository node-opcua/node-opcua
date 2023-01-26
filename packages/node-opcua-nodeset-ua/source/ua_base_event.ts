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
    eventId: UAProperty<Buffer, DataType.ByteString>;
    eventType: UAProperty<NodeId, DataType.NodeId>;
    sourceNode: UAProperty<NodeId, DataType.NodeId>;
    sourceName: UAProperty<UAString, DataType.String>;
    time: UAProperty<Date, DataType.DateTime>;
    receiveTime: UAProperty<Date, DataType.DateTime>;
    localTime?: UAProperty<DTTimeZone, DataType.ExtensionObject>;
    message: UAProperty<LocalizedText, DataType.LocalizedText>;
    severity: UAProperty<UInt16, DataType.UInt16>;
}
export interface UABaseEvent extends UAObject, UABaseEvent_Base {
}