import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTRfidScanResult } from "./dt_rfid_scan_result";
import type { UAAutoIdScanEvent, UAAutoIdScanEvent_Base } from "./ua_auto_id_scan_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/                         |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |RfidScanEventType i=1006                                    |
 * |isAbstract      |true                                                        |
 */
export interface UARfidScanEvent_Base extends UAAutoIdScanEvent_Base {
    scanResult: UAProperty<DTRfidScanResult[], DataType.ExtensionObject>;
}
export interface UARfidScanEvent extends Omit<UAAutoIdScanEvent, "scanResult">, UARfidScanEvent_Base {}