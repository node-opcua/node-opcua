// ----- this file has been automatically generated - do not edit
import { UInt16 } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/               |
 * | nodeClass |DataType                                          |
 * | name      |3:ScanDataEpc                                     |
 * | isAbstract|false                                             |
 */
export interface DTScanDataEpc extends DTStructure  {
  PC: UInt16; // UInt16 ns=0;i=5
  uId: Buffer; // ByteString ns=0;i=15
  XPC_W1: UInt16; // UInt16 ns=0;i=5
  XPC_W2: UInt16; // UInt16 ns=0;i=5
}