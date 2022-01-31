// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { Int64 } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |EnumValueType                                     |
 * | isAbstract|false                                             |
 */
export interface DTEnumValue extends DTStructure  {
  value: Int64; // Int64 ns=0;i=8
  displayName: LocalizedText; // LocalizedText ns=0;i=21
  description: LocalizedText; // LocalizedText ns=0;i=21
}