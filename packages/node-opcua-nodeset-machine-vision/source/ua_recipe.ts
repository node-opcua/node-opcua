import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAFile } from "node-opcua-nodeset-ua/dist/ua_file";
import type { DataType } from "node-opcua-variant";

import type { DTProductId } from "./dt_product_id";
import type { DTRecipeIdExternal } from "./dt_recipe_id_external";
import type { DTRecipeIdInternal } from "./dt_recipe_id_internal";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision                   |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |RecipeType i=1002                                           |
 * |isAbstract      |false                                                       |
 */
export interface UARecipe_Base {
    /**
     * externalId
     * Recipe ID for identifying the recipe outside the
     * vision system. The ExternalID is only managed by
     * the host system.
     */
    externalId?: UAProperty<DTRecipeIdExternal, DataType.ExtensionObject>;
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
    internalId: UAProperty<DTRecipeIdInternal, DataType.ExtensionObject>;
    isPrepared: UAProperty<boolean, DataType.Boolean>;
    /**
     * lastModified
     * The time when this recipe was last modified.
     */
    lastModified: UAProperty<Date, DataType.DateTime>;
    linkedProducts?: UAProperty<DTProductId[], DataType.ExtensionObject>;
    linkProduct?: UAMethod;
    prepare: UAMethod;
    unlinkProduct?: UAMethod;
    unprepare: UAMethod;
}
export interface UARecipe extends UAObject, UARecipe_Base {}