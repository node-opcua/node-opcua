// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTUnion } from "node-opcua-nodeset-ua/source/dt_union"
import { DTScanDataEpc } from "./dt_scan_data_epc"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/               |
 * | nodeClass |DataType                                          |
 * | name      |3:ScanData                                        |
 * | isAbstract|false                                             |
 */
export interface DTScanData_0 extends DTUnion {
  byteString: Buffer; // ByteString ns=0;i=15
  string?: never
  epc?: never
  custom?: never
}
export interface DTScanData_1 extends DTUnion {
  byteString?: never
  string: UAString; // String ns=0;i=12
  epc?: never
  custom?: never
}
export interface DTScanData_2 extends DTUnion {
  byteString?: never
  string?: never
  epc: DTScanDataEpc; // ExtensionObject ns=3;i=3024
  custom?: never
}
export interface DTScanData_3 extends DTUnion {
  byteString?: never
  string?: never
  epc?: never
  custom: undefined; // Null ns=0;i=0
}
export type DTScanData = 
  | DTScanData_0
  | DTScanData_1
  | DTScanData_2
  | DTScanData_3
  ;