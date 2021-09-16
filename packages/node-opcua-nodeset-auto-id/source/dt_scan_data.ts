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
export interface DTScanData extends DTUnion  {
  byteString: Buffer; // ByteString ns=0;i=15
  string: UAString; // String ns=0;i=12
  epc: DTScanDataEpc; // ExtensionObject ns=3;i=3024
  custom: undefined; // Null ns=0;i=0
}