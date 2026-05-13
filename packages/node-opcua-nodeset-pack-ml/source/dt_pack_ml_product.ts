import type { Int32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

import type { DTPackMLDescriptor } from "./dt_pack_ml_descriptor";
import type { DTPackMLIngredients } from "./dt_pack_ml_ingredients";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/PackML/                         |
 * | nodeClass |DataType                                                    |
 * | name      |PackMLProductDataType                                       |
 * | isAbstract|false                                                       |
 */
export interface DTPackMLProduct extends DTStructure {
  /** A unique number assigned to the product.*/
  productID: Int32; // Int32 ns=0;i=6
  /** The array of Process variables associated with this product*/
  processVariables: DTPackMLDescriptor[]; // ExtensionObject ns=20;i=16
  /** The array of ingredients associated with this product.*/
  ingredients: DTPackMLIngredients[]; // ExtensionObject ns=20;i=17
}
export interface UDTPackMLProduct extends ExtensionObject, DTPackMLProduct {};