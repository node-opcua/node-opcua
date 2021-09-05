// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { Int16, SByte, UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |CurrencyUnitType                                  |
 * | isAbstract|false                                             |
 */
export interface DTCurrencyUnit extends DTStructure  {
  numericCode: Int16; // Int16 ns=0;i=4
  exponent: SByte; // SByte ns=0;i=2
  alphabeticCode: UAString; // String ns=0;i=12
  currency: LocalizedText; // LocalizedText ns=0;i=21
}