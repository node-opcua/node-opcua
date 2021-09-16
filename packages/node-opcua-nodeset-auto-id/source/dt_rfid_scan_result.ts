// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTScanResult } from "./dt_scan_result"
import { DTScanData } from "./dt_scan_data"
import { DTLocation } from "./dt_location"
import { DTRfidSighting } from "./dt_rfid_sighting"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/               |
 * | nodeClass |DataType                                          |
 * | name      |3:RfidScanResult                                  |
 * | isAbstract|false                                             |
 */
export interface DTRfidScanResult extends DTScanResult  {
/** Defines the format of the ScanData as string.*/
  codeType: UAString; // String ns=3;i=3031
/** Holds the information about the detected objects e.g. the detected transponders.*/
  scanData: DTScanData; // ExtensionObject ns=3;i=3020
/** Timestamp of the ScanResult creation.*/
  timestamp: Date; // DateTime ns=0;i=294
/** Returns the location of the object detection.*/
  location: DTLocation; // ExtensionObject ns=3;i=3008
/** Returns additional information on the RFID-related properties of the scan event.*/
  sighting: DTRfidSighting[]; // ExtensionObject ns=3;i=3006
}