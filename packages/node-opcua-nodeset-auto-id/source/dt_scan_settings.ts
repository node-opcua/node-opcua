// ----- this file has been automatically generated - do not edit
import { Variant } from "node-opcua-variant"
import { Int32 } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/               |
 * | nodeClass |DataType                                          |
 * | name      |3:ScanSettings                                    |
 * | isAbstract|false                                             |
 */
export interface DTScanSettings extends DTStructure  {
  duration: number; // Double ns=0;i=290
  cycles: Int32; // Int32 ns=0;i=6
  dataAvailable: boolean; // Boolean ns=0;i=1
  locationType: Variant; // Variant ns=3;i=3009
}