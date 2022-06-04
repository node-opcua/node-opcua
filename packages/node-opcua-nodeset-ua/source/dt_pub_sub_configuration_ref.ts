// ----- this file has been automatically generated - do not edit
import { UInt32, UInt16 } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |PubSubConfigurationRefDataType                    |
 * | isAbstract|false                                             |
 */
export interface DTPubSubConfigurationRef extends DTStructure  {
  configurationMask: UInt32; // UInt32 ns=0;i=25517
  elementIndex: UInt16; // UInt16 ns=0;i=5
  connectionIndex: UInt16; // UInt16 ns=0;i=5
  groupIndex: UInt16; // UInt16 ns=0;i=5
}