// ----- this file has been automatically generated - do not edit
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |DoubleComplexNumberType                           |
 * | isAbstract|false                                             |
 */
export interface DTDoubleComplexNumber extends DTStructure {
  real: number; // Double ns=0;i=11
  imaginary: number; // Double ns=0;i=11
}
export interface UDTDoubleComplexNumber extends ExtensionObject, DTDoubleComplexNumber {};