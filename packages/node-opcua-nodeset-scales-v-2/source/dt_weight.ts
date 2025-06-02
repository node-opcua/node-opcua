// ----- this file has been automatically generated - do not edit
import { ExtensionObject } from "node-opcua-extension-object"
import { DTAbstractWeight } from "./dt_abstract_weight"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Scales/V2/                      |
 * | nodeClass |DataType                                                    |
 * | name      |WeightType                                                  |
 * | isAbstract|false                                                       |
 */
export interface DTWeight extends DTAbstractWeight {
  gross: number; // Double ns=0;i=11
  net: number; // Double ns=0;i=11
  tare: number; // Double ns=0;i=11
}
export interface UDTWeight extends ExtensionObject, DTWeight {};