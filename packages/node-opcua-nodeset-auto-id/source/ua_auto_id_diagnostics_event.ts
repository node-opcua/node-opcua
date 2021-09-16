// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt16, UAString } from "node-opcua-basic-types"
import { DTTimeZone } from "node-opcua-nodeset-ua/source/dt_time_zone"
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/source/ua_base_event"
/**
 * AutoID diagnostic data
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |3:AutoIdDiagnosticsEventType ns=3;i=1010          |
 * |isAbstract      |true                                              |
 */
export interface UAAutoIdDiagnosticsEvent_Base extends UABaseEvent_Base {
    /**
     * deviceName
     * Name of the device of the diagnostic data.
     */
    deviceName: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UAAutoIdDiagnosticsEvent extends UABaseEvent, UAAutoIdDiagnosticsEvent_Base {
}