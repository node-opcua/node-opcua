import type { UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTFilterOperand } from "./dt_filter_operand";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |ElementOperand                                              |
 * | isAbstract|false                                                       |
 */
export interface DTElementOperand extends DTFilterOperand {
  index: UInt32; // UInt32 ns=0;i=7
}
export interface UDTElementOperand extends ExtensionObject, DTElementOperand {};