import type { UAMethod, UAObject } from "node-opcua-address-space-base";

// ----- this file has been automatically generated - do not edit

/**
 * Contains methods and properties required for
 * managing recipes.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |RecipeManagementType i=30                                   |
 * |isAbstract      |false                                                       |
 */
export interface UARecipeManagement_Base {
   // PlaceHolder for $Recipe_no$
    /**
     * addRecipe
     * Method to add an additional recipe of RecipeType.
     */
    addRecipe?: UAMethod;
    /**
     * removeRecipe
     * Method to remove a recipe of RecipeType.
     */
    removeRecipe?: UAMethod;
}
export interface UARecipeManagement extends UAObject, UARecipeManagement_Base {}