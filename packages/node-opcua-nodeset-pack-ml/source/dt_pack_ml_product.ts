// ----- this file has been automatically generated - do not edit
import { Int32 } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure"
import { DTPackMLDescriptor } from "./dt_pack_ml_descriptor"
import { DTPackMLIngredients } from "./dt_pack_ml_ingredients"
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