import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTLocation } from "./dt_location";
import type { DTRfidSighting } from "./dt_rfid_sighting";
import type { DTScanData } from "./dt_scan_data";
import type { DTScanResult } from "./dt_scan_result";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/                         |
 * | nodeClass |DataType                                                    |
 * | name      |RfidScanResult                                              |
 * | isAbstract|false                                                       |
 */
export interface DTRfidScanResult extends DTScanResult {
  /** Defines the format of the ScanData as string.*/
  codeType: UAString; // String ns=3;i=3031
  /** Holds the information about the detected objects e.g. the detected transponders.*/
  scanData: DTScanData; // ExtensionObject ns=3;i=3020
  /** Timestamp of the ScanResult creation.*/
  timestamp: Date; // DateTime ns=0;i=294
  /** Returns the location of the object detection.*/
  location?: DTLocation; // ExtensionObject ns=3;i=3008
  /** Returns additional information on the RFID-related properties of the scan event.*/
  sighting: DTRfidSighting[]; // ExtensionObject ns=3;i=3006
}
export interface UDTRfidScanResult extends ExtensionObject, DTRfidScanResult {};