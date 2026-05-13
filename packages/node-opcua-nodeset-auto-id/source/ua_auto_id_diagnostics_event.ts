import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/dist/ua_base_event";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

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
export interface UAAutoIdDiagnosticsEvent extends UABaseEvent, UAAutoIdDiagnosticsEvent_Base {}