// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/source/ua_base_event"
import { DTScanResult } from "./dt_scan_result"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |3:AutoIdScanEventType ns=3;i=1004                 |
 * |isAbstract      |true                                              |
 */
export interface UAAutoIdScanEvent_Base extends UABaseEvent_Base {
    deviceName: UAProperty<UAString, /*z*/DataType.String>;
    scanResult: UAProperty<DTScanResult[], /*z*/DataType.ExtensionObject>;
}
export interface UAAutoIdScanEvent extends UABaseEvent, UAAutoIdScanEvent_Base {
}