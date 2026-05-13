import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTOcrScanResult } from "./dt_ocr_scan_result";
import type { UAAutoIdScanEvent, UAAutoIdScanEvent_Base } from "./ua_auto_id_scan_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/                         |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |OcrScanEventType i=1005                                     |
 * |isAbstract      |true                                                        |
 */
export interface UAOcrScanEvent_Base extends UAAutoIdScanEvent_Base {
    scanResult: UAProperty<DTOcrScanResult[], DataType.ExtensionObject>;
}
export interface UAOcrScanEvent extends Omit<UAAutoIdScanEvent, "scanResult">, UAOcrScanEvent_Base {}