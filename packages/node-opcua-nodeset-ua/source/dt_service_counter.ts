import type { UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

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