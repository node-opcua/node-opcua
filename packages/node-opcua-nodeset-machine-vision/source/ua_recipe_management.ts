// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { DTProduct } from "./dt_product"
import { UAProductFolder } from "./ua_product_folder"
import { UARecipeFolder } from "./ua_recipe_folder"
import { UARecipeTransfer } from "./ua_recipe_transfer"
export interface UARecipeManagement_products extends Omit<UAProductFolder, "$Product$"> { // Object
      "$Product$": UABaseDataVariable<DTProduct, /*z*/DataType.ExtensionObject>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision         |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |4:RecipeManagementType ns=4;i=1004                |
 * |isAbstract      |false                                             |
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
export interface UARecipeManagement extends UAObject, UARecipeManagement_Base {
}