// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTScanResult } from "./dt_scan_result"
import { DTRfidScanResult } from "./dt_rfid_scan_result"
import { UAAutoIdScanEvent, UAAutoIdScanEvent_Base } from "./ua_auto_id_scan_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |3:RfidScanEventType ns=3;i=1006                   |
 * |isAbstract      |true                                              |
 */
export interface UARfidScanEvent_Base extends UAAutoIdScanEvent_Base {
    scanResult: UAProperty<DTRfidScanResult[], /*z*/DataType.ExtensionObject>;
}
export interface UARfidScanEvent extends Omit<UAAutoIdScanEvent, "scanResult">, UARfidScanEvent_Base {
}