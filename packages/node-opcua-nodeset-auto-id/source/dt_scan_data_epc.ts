import type { UInt16 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/                         |
 * | nodeClass |DataType                                                    |
 * | name      |ScanDataEpc                                                 |
 * | isAbstract|false                                                       |
 */
export interface DTScanDataEpc extends DTStructure {
  PC: UInt16; // UInt16 ns=0;i=5
  uId: Buffer; // ByteString ns=0;i=15
  XPC_W1: UInt16; // UInt16 ns=0;i=5
  XPC_W2: UInt16; // UInt16 ns=0;i=5
}
export interface UDTScanDataEpc extends ExtensionObject, DTScanDataEpc {};