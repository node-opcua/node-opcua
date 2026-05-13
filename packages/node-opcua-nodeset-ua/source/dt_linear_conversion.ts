import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |LinearConversionDataType                                    |
 * | isAbstract|false                                                       |
 */
export interface DTLinearConversion extends DTStructure {
  initialAddend: number; // Float ns=0;i=10
  multiplicand: number; // Float ns=0;i=10
  divisor: number; // Float ns=0;i=10
  finalAddend: number; // Float ns=0;i=10
}
export interface UDTLinearConversion extends ExtensionObject, DTLinearConversion {};