import type { UAMethod, UAObject } from "node-opcua-address-space-base";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { DTProduct } from "./dt_product";
import type { UAProductFolder } from "./ua_product_folder";
import type { UARecipeFolder } from "./ua_recipe_folder";
import type { UARecipeTransfer } from "./ua_recipe_transfer";

// ----- this file has been automatically generated - do not edit

export interface UARecipeManagement_products extends Omit<UAProductFolder, "$Product$"> { // Object
      "$Product$": UABaseDataVariable<DTProduct, DataType.ExtensionObject>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision                   |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |RecipeManagementType i=1004                                 |
 * |isAbstract      |false                                                       |
 */
export interface UARecipeManagement_Base {
    addRecipe?: UAMethod;
    getRecipeListFiltered: UAMethod;
    prepareProduct?: UAMethod;
    prepareRecipe: UAMethod;
    products?: UARecipeManagement_products;
    recipes?: UARecipeFolder;
    recipeTransfer?: UARecipeTransfer;
    releaseRecipeHandle?: UAMethod;
    removeRecipe?: UAMethod;
    unlinkProduct?: UAMethod;
    unprepareProduct?: UAMethod;
    unprepareRecipe: UAMethod;
}
export interface UARecipeManagement extends UAObject, UARecipeManagement_Base {}