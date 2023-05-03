// ----- this file has been automatically generated - do not edit
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |ComplexNumberType                                           |
 * | isAbstract|false                                                       |
 */
export interface DTComplexNumber extends DTStructure {
  real: number; // Float ns=0;i=10
  imaginary: number; // Float ns=0;i=10
}
export interface UDTComplexNumber extends ExtensionObject, DTComplexNumber {};