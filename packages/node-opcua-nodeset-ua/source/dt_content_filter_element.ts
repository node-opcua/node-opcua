// ----- this file has been automatically generated - do not edit
import { Variant } from "node-opcua-variant"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |ContentFilterElement                              |
 * | isAbstract|false                                             |
 */
export interface DTContentFilterElement extends DTStructure  {
  filterOperator: Variant; // Variant ns=0;i=576
  filterOperands: DTStructure[]; // ExtensionObject ns=0;i=22
}