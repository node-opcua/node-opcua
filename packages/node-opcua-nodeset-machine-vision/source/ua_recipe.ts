// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAFile } from "node-opcua-nodeset-ua/source/ua_file"
import { DTRecipeIdExternal } from "./dt_recipe_id_external"
import { DTRecipeIdInternal } from "./dt_recipe_id_internal"
import { DTProductId } from "./dt_product_id"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision         |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |4:RecipeType ns=4;i=1002                          |
 * |isAbstract      |false                                             |
 */
export interface UARecipe_Base {
    /**
     * externalId
     * Recipe ID for identifying the recipe outside the
     * vision system. The ExternalID is only managed by
     * the host system.
     */
    externalId?: UAProperty<DTRecipeIdExternal, /*z*/DataType.ExtensionObject>;
    /**
     * handle
     * The file handle refers to the recipe data, which
     * are teated as a BLOB, i.e. they are not
     * interpreted outside the system. They are accessed
     * via OPC UA file operations.
     */
    handle?: UAFile;
    /**
     * internalId
     * System-wide unique ID for identifying a recipe.
     * This ID is assigned by the vision system.
     */
    internalId: UAProperty<DTRecipeIdInternal, /*z*/DataType.ExtensionObject>;
    isPrepared: UAProperty<boolean, /*z*/DataType.Boolean>;
    /**
     * lastModified
     * The time when this recipe was last modified.
     */
    lastModified: UAProperty<Date, /*z*/DataType.DateTime>;
    linkedProducts?: UAProperty<DTProductId[], /*z*/DataType.ExtensionObject>;
    linkProduct?: UAMethod;
    prepare: UAMethod;
    unlinkProduct?: UAMethod;
    unprepare: UAMethod;
}
export interface UARecipe extends UAObject, UARecipe_Base {
}