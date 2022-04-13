// ----- this file has been automatically generated - do not edit
import { DTStructure } from "./dt_structure"
import { EnumFilterOperator } from "./enum_filter_operator"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |ContentFilterElement                              |
 * | isAbstract|false                                             |
 */
export interface DTContentFilterElement extends DTStructure  {
  filterOperator: EnumFilterOperator; // Int32 ns=0;i=576
  filterOperands: DTStructure[]; // ExtensionObject ns=0;i=22
}