// ----- this file has been automatically generated - do not edit
import { NodeId } from "node-opcua-nodeid"
import { UAString } from "node-opcua-basic-types"
import { DTScanResult } from "./dt_scan_result"
import { DTScanData } from "./dt_scan_data"
import { DTLocation } from "./dt_location"
import { DTPosition } from "./dt_position"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/               |
 * | nodeClass |DataType                                          |
 * | name      |3:OpticalScanResult                               |
 * | isAbstract|false                                             |
 */
export interface DTOpticalScanResult extends DTScanResult  {
/** Defines the format of the ScanData as string.*/
  codeType: UAString; // String ns=3;i=3031
/** Holds the information about the detected objects e.g. the detected transponders.*/
  scanData: DTScanData; // ExtensionObject ns=3;i=3020
/** Timestamp of the ScanResult creation.*/
  timestamp: Date; // DateTime ns=0;i=294
/** Returns the location of the object detection.*/
  location: DTLocation; // ExtensionObject ns=3;i=3008
/** Returns the quality of the 1D/2D code.*/
  grade: number; // Float ns=0;i=10
/** Returns the position of the text within the image.*/
  position: DTPosition; // ExtensionObject ns=3;i=3004
  symbology: UAString; // String ns=0;i=12
  imageId: NodeId; // NodeId ns=0;i=17
}