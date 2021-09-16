// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
import { DTScanData } from "./dt_scan_data"
import { DTLocation } from "./dt_location"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/               |
 * | nodeClass |DataType                                          |
 * | name      |3:ScanResult                                      |
 * | isAbstract|true                                              |
 */
export interface DTScanResult extends DTStructure  {
/** Defines the format of the ScanData as string.*/
  codeType: UAString; // String ns=3;i=3031
/** Holds the information about the detected objects e.g. the detected transponders.*/
  scanData: DTScanData; // ExtensionObject ns=3;i=3020
/** Timestamp of the ScanResult creation.*/
  timestamp: Date; // DateTime ns=0;i=294
/** Returns the location of the object detection.*/
  location: DTLocation; // ExtensionObject ns=3;i=3008
}