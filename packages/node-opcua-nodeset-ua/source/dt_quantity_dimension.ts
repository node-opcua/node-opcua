// ----- this file has been automatically generated - do not edit
import { SByte } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |QuantityDimension                                           |
 * | isAbstract|false                                                       |
 */
export interface DTQuantityDimension extends DTStructure {
  massExponent: SByte; // SByte ns=0;i=2
  lengthExponent: SByte; // SByte ns=0;i=2
  timeExponent: SByte; // SByte ns=0;i=2
  electricCurrentExponent: SByte; // SByte ns=0;i=2
  amountOfSubstanceExponent: SByte; // SByte ns=0;i=2
  luminousIntensityExponent: SByte; // SByte ns=0;i=2
  absoluteTemperatureExponent: SByte; // SByte ns=0;i=2
  dimensionlessExponent: SByte; // SByte ns=0;i=2
}
export interface UDTQuantityDimension extends ExtensionObject, DTQuantityDimension {};