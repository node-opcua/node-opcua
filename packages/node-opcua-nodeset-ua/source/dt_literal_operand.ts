import type { ExtensionObject } from "node-opcua-extension-object";
import type { Variant } from "node-opcua-variant";

import type { DTFilterOperand } from "./dt_filter_operand";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |LiteralOperand                                              |
 * | isAbstract|false                                                       |
 */
export interface DTLiteralOperand extends DTFilterOperand {
  value: Variant; // Variant ns=0;i=24
}
export interface UDTLiteralOperand extends ExtensionObject, DTLiteralOperand {};