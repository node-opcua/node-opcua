// ----- this file has been automatically generated - do not edit
import { NodeId } from "node-opcua-nodeid"
import { Byte, UAString } from "node-opcua-basic-types"
import { DTScanResult } from "./dt_scan_result"
import { DTScanData } from "./dt_scan_data"
import { DTLocation } from "./dt_location"
import { DTPosition } from "./dt_position"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/               |
 * | nodeClass |DataType                                          |
 * | name      |3:OcrScanResult                                   |
 * | isAbstract|false                                             |
 */
export interface DTOcrScanResult extends DTScanResult  {
/** Defines the format of the ScanData as string.*/
  codeType: UAString; // String ns=3;i=3031
/** Holds the information about the detected objects e.g. the detected transponders.*/
  scanData: DTScanData; // ExtensionObject ns=3;i=3020
/** Timestamp of the ScanResult creation.*/
  timestamp: Date; // DateTime ns=0;i=294
/** Returns the location of the object detection.*/
  location: DTLocation; // ExtensionObject ns=3;i=3008
/** NodeId of the original scan image file object used for this scan result.*/
  imageId: NodeId; // NodeId ns=0;i=17
/** Returns the probability of correct decoding.*/
  quality: Byte; // Byte ns=0;i=3
/** Returns the position of the text within the image.*/
  position: DTPosition; // ExtensionObject ns=3;i=3004
/** Returns the font name used for decoding.*/
  font: UAString; // String ns=0;i=12
/** Returns the required decoding time.*/
  decodingTime: Date; // DateTime ns=0;i=294
}