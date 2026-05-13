import type { Int32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

import type { EnumLocationType } from "./enum_location_type";

// ----- this file has been automatically generated - do not edit

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