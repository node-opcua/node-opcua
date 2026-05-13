import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTOpticalVerifierScanResult } from "./dt_optical_verifier_scan_result";
import type { UAOpticalScanEvent, UAOpticalScanEvent_Base } from "./ua_optical_scan_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/                         |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |OpticalVerifierScanEventType i=1013                         |
 * |isAbstract      |true                                                        |
 */
export interface UAOpticalVerifierScanEvent_Base extends UAOpticalScanEvent_Base {
    scanResult: UAProperty<DTOpticalVerifierScanResult[], DataType.ExtensionObject>;
}
export interface UAOpticalVerifierScanEvent extends Omit<UAOpticalScanEvent, "scanResult">, UAOpticalVerifierScanEvent_Base {}