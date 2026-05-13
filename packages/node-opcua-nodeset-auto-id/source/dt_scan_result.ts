import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

import type { DTLocation } from "./dt_location";
import type { DTScanData } from "./dt_scan_data";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/                         |
 * | nodeClass |DataType                                                    |
 * | name      |ScanResult                                                  |
 * | isAbstract|true                                                        |
 */
export interface DTScanResult extends DTStructure {
  /** Defines the format of the ScanData as string.*/
  codeType: UAString; // String ns=3;i=3031
  /** Holds the information about the detected objects e.g. the detected transponders.*/
  scanData: DTScanData; // ExtensionObject ns=3;i=3020
  /** Timestamp of the ScanResult creation.*/
  timestamp: Date; // DateTime ns=0;i=294
  /** Returns the location of the object detection.*/
  location?: DTLocation; // ExtensionObject ns=3;i=3008
}
export interface UDTScanResult extends ExtensionObject, DTScanResult {};