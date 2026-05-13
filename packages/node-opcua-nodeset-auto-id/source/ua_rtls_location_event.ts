import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTRtlsLocationResult } from "./dt_rtls_location_result";
import type { UAAutoIdScanEvent, UAAutoIdScanEvent_Base } from "./ua_auto_id_scan_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/                         |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |RtlsLocationEventType i=1014                                |
 * |isAbstract      |true                                                        |
 */
export interface UARtlsLocationEvent_Base extends UAAutoIdScanEvent_Base {
    scanResult: UAProperty<DTRtlsLocationResult[], DataType.ExtensionObject>;
}
export interface UARtlsLocationEvent extends Omit<UAAutoIdScanEvent, "scanResult">, UARtlsLocationEvent_Base {}