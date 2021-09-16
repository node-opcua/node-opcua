// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTScanResult } from "./dt_scan_result"
import { DTRtlsLocationResult } from "./dt_rtls_location_result"
import { UAAutoIdScanEvent, UAAutoIdScanEvent_Base } from "./ua_auto_id_scan_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |3:RtlsLocationEventType ns=3;i=1014               |
 * |isAbstract      |true                                              |
 */
export interface UARtlsLocationEvent_Base extends UAAutoIdScanEvent_Base {
    scanResult: UAProperty<DTRtlsLocationResult[], /*z*/DataType.ExtensionObject>;
}
export interface UARtlsLocationEvent extends Omit<UAAutoIdScanEvent, "scanResult">, UARtlsLocationEvent_Base {
}