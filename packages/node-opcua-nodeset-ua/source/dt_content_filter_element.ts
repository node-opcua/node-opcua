import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";
import type { EnumFilterOperator } from "./enum_filter_operator";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |ContentFilterElement                                        |
 * | isAbstract|false                                                       |
 */
export interface DTContentFilterElement extends DTStructure {
  filterOperator: EnumFilterOperator; // Int32 ns=0;i=576
  filterOperands: DTStructure[]; // ExtensionObject ns=0;i=22
}
export interface UDTContentFilterElement extends ExtensionObject, DTContentFilterElement {};