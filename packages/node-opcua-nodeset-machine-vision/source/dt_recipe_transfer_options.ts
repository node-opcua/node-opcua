// ----- this file has been automatically generated - do not edit
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
import { DTRecipeIdInternal } from "./dt_recipe_id_internal"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineVision         |
 * | nodeClass |DataType                                          |
 * | name      |4:RecipeTransferOptions                           |
 * | isAbstract|false                                             |
 */
export interface DTRecipeTransferOptions extends DTStructure  {
/** The InternalId of the recipe to be transferred to or from the client.*/
  internalId: DTRecipeIdInternal; // ExtensionObject ns=4;i=3013
}