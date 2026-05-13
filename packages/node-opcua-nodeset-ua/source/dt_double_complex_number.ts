import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |DoubleComplexNumberType                                     |
 * | isAbstract|false                                                       |
 */
export interface DTDoubleComplexNumber extends DTStructure {
  real: number; // Double ns=0;i=11
  imaginary: number; // Double ns=0;i=11
}
export interface UDTDoubleComplexNumber extends ExtensionObject, DTDoubleComplexNumber {};