// ----- this file has been automatically generated - do not edit
import { VariantOptions } from "node-opcua-variant"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTFilterOperand } from "./dt_filter_operand"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |LiteralOperand                                              |
 * | isAbstract|false                                                       |
 */
export interface DTLiteralOperand extends DTFilterOperand {
  value: VariantOptions; // Variant ns=0;i=0
}
export interface UDTLiteralOperand extends ExtensionObject, DTLiteralOperand {};