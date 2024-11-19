// ----- this file has been automatically generated - do not edit
import { Int32 } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
import { EnumLocationType } from "./enum_location_type"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/                         |
 * | nodeClass |DataType                                                    |
 * | name      |ScanSettings                                                |
 * | isAbstract|false                                                       |
 */
export interface DTScanSettings extends DTStructure {
  duration: number; // Double ns=0;i=290
  cycles: Int32; // Int32 ns=0;i=6
  dataAvailable: boolean; // Boolean ns=0;i=1
  locationType?: EnumLocationType; // Int32 ns=3;i=3009
}
export interface UDTScanSettings extends ExtensionObject, DTScanSettings {};