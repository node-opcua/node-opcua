// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UInt64, UInt32, UInt16, UAString } from "node-opcua-basic-types"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UAFolder, UAFolder_Base } from "node-opcua-nodeset-ua/source/ua_folder"
import { DTRecipeIdExternal } from "./dt_recipe_id_external"
import { DTRecipeIdInternal } from "./dt_recipe_id_internal"
import { DTProductId } from "./dt_product_id"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision         |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |4:RecipeFolderType ns=4;i=1008                    |
 * |isAbstract      |false                                             |
 */
export interface UARecipeFolder_Base extends UAFolder_Base {
}
export interface UARecipeFolder extends UAFolder, UARecipeFolder_Base {
}