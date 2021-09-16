// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTScanResult } from "./dt_scan_result"
import { DTScanData } from "./dt_scan_data"
import { DTLocation } from "./dt_location"
import { DTRotation } from "./dt_rotation"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/               |
 * | nodeClass |DataType                                          |
 * | name      |3:RtlsLocationResult                              |
 * | isAbstract|false                                             |
 */
export interface DTRtlsLocationResult extends DTScanResult  {
/** Defines the format of the ScanData as string.*/
  codeType: UAString; // String ns=3;i=3031
/** Holds the information about the detected objects e.g. the detected transponders.*/
  scanData: DTScanData; // ExtensionObject ns=3;i=3020
/** Timestamp of the ScanResult creation.*/
  timestamp: Date; // DateTime ns=0;i=294
/** Returns the location of the object detection.*/
  location: DTLocation; // ExtensionObject ns=3;i=3008
  speed: number; // Double ns=0;i=11
  heading: number; // Double ns=0;i=11
  rotation: DTRotation; // ExtensionObject ns=3;i=3029
  receiveTime: Date; // DateTime ns=0;i=294
}