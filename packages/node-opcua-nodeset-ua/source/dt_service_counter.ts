// ----- this file has been automatically generated - do not edit
import { UInt32 } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |ServiceCounterDataType                                      |
 * | isAbstract|false                                                       |
 */
export interface DTServiceCounter extends DTStructure {
  totalCount: UInt32; // UInt32 ns=0;i=7
  errorCount: UInt32; // UInt32 ns=0;i=7
}
export interface UDTServiceCounter extends ExtensionObject, DTServiceCounter {};