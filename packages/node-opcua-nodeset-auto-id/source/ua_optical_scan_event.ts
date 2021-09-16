// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTScanResult } from "./dt_scan_result"
import { DTOpticalScanResult } from "./dt_optical_scan_result"
import { UAAutoIdScanEvent, UAAutoIdScanEvent_Base } from "./ua_auto_id_scan_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |3:OpticalScanEventType ns=3;i=1009                |
 * |isAbstract      |true                                              |
 */
export interface UAOpticalScanEvent_Base extends UAAutoIdScanEvent_Base {
    scanResult: UAProperty<DTOpticalScanResult[], /*z*/DataType.ExtensionObject>;
}
export interface UAOpticalScanEvent extends Omit<UAAutoIdScanEvent, "scanResult">, UAOpticalScanEvent_Base {
}