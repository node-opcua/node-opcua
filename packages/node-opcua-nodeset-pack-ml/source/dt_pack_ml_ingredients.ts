// ----- this file has been automatically generated - do not edit
import { Int32 } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
import { DTPackMLDescriptor } from "./dt_pack_ml_descriptor"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/PackML/               |
 * | nodeClass |DataType                                          |
 * | name      |15:PackMLIngredientsDataType                      |
 * | isAbstract|false                                             |
 */
export interface DTPackMLIngredients extends DTStructure {
  /** A unique number assigned to the ingredient.*/
  ingredientID: Int32; // Int32 ns=0;i=6
  /** The array of Parameters that correspond to the ingredient*/
  parameter: DTPackMLDescriptor[]; // ExtensionObject ns=15;i=16
}
export interface UDTPackMLIngredients extends ExtensionObject, DTPackMLIngredients {};