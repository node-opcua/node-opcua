// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { Int64, UAString } from "node-opcua-basic-types"
import { DTEnumValue } from "./dt_enum_value"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |EnumField                                         |
 * | isAbstract|false                                             |
 */
export interface DTEnumField extends DTEnumValue  {
  value: Int64; // Int64 ns=0;i=8
  displayName: LocalizedText; // LocalizedText ns=0;i=21
  description: LocalizedText; // LocalizedText ns=0;i=21
  name: UAString; // String ns=0;i=12
}