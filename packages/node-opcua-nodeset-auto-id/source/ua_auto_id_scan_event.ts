import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/dist/ua_base_event";
import type { DataType } from "node-opcua-variant";

import type { DTScanResult } from "./dt_scan_result";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/                         |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AutoIdScanEventType i=1004                                  |
 * |isAbstract      |true                                                        |
 */
export interface UAAutoIdScanEvent_Base extends UABaseEvent_Base {
    deviceName: UAProperty<UAString, DataType.String>;
    scanResult: UAProperty<DTScanResult[], DataType.ExtensionObject>;
}
export interface UAAutoIdScanEvent extends UABaseEvent, UAAutoIdScanEvent_Base {}