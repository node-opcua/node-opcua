// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTOcrScanResult } from "./dt_ocr_scan_result"
import { UAAutoIdScanEvent, UAAutoIdScanEvent_Base } from "./ua_auto_id_scan_event"
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
export interface UAOcrScanEvent extends Omit<UAAutoIdScanEvent, "scanResult">, UAOcrScanEvent_Base {
}