// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UAFolder, UAFolder_Base } from "./ua_folder"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AliasNameCategoryType i=23456                               |
 * |isAbstract      |false                                                       |
 */
export interface UAAliasNameCategory_Base extends UAFolder_Base {
    findAlias: UAMethod;
    lastChange?: UAProperty<UInt32, DataType.UInt32>;
   // PlaceHolder for $Alias$
   // PlaceHolder for $SubAliasNameCategories$
}
export interface UAAliasNameCategory extends UAFolder, UAAliasNameCategory_Base {
}