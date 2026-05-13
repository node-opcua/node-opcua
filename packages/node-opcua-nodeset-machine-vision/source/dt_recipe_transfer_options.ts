import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

import type { DTRecipeIdInternal } from "./dt_recipe_id_internal";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineVision                   |
 * | nodeClass |DataType                                                    |
 * | name      |RecipeTransferOptions                                       |
 * | isAbstract|false                                                       |
 */
export interface DTRecipeTransferOptions extends DTStructure {
  /** The InternalId of the recipe to be transferred to or from the client.*/
  internalId: DTRecipeIdInternal; // ExtensionObject ns=4;i=3013
}
export interface UDTRecipeTransferOptions extends ExtensionObject, DTRecipeTransferOptions {};