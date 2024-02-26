// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { UInt32, UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |BitFieldDefinition                                          |
 * | isAbstract|false                                                       |
 */
export interface DTBitFieldDefinition extends DTStructure {
  name: UAString; // String ns=0;i=12
  description: LocalizedText; // LocalizedText ns=0;i=21
  reserved: boolean; // Boolean ns=0;i=1
  startingBitPosition: UInt32; // UInt32 ns=0;i=7
  endingBitPosition: UInt32; // UInt32 ns=0;i=7
}
export interface UDTBitFieldDefinition extends ExtensionObject, DTBitFieldDefinition {};