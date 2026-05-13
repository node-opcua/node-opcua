import type { Int32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

import type { DTPackMLDescriptor } from "./dt_pack_ml_descriptor";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/PackML/                         |
 * | nodeClass |DataType                                                    |
 * | name      |PackMLIngredientsDataType                                   |
 * | isAbstract|false                                                       |
 */
export interface DTPackMLIngredients extends DTStructure {
  /** A unique number assigned to the ingredient.*/
  ingredientID: Int32; // Int32 ns=0;i=6
  /** The array of Parameters that correspond to the ingredient*/
  parameter: DTPackMLDescriptor[]; // ExtensionObject ns=20;i=16
}
export interface UDTPackMLIngredients extends ExtensionObject, DTPackMLIngredients {};