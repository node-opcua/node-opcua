// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/dist/ua_base_event"
/**
 * AutoID diagnostic data
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/                         |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AutoIdDiagnosticsEventType i=1010                           |
 * |isAbstract      |true                                                        |
 */
export interface UAAutoIdDiagnosticsEvent_Base extends UABaseEvent_Base {
    /**
     * deviceName
     * Name of the device of the diagnostic data.
     */
    deviceName: UAProperty<UAString, DataType.String>;
}
export interface UAAutoIdDiagnosticsEvent extends UABaseEvent, UAAutoIdDiagnosticsEvent_Base {
}