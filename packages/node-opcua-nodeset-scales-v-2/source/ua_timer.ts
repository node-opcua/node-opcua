import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { UARecipeElement, UARecipeElement_Base } from "./ua_recipe_element";

// ----- this file has been automatically generated - do not edit

/**
 * TimerType represents a timer step in a recipe.
 * The recipe waits until at least Duration has
 * passed from now.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TimerType i=36                                              |
 * |isAbstract      |false                                                       |
 */
export interface UATimer_Base extends UARecipeElement_Base {
    /**
     * duration
     * Defines the period of time the processing needs
     * to wait before processing the next RecipeElement.
     */
    duration: UABaseDataVariable<number, DataType.Double>;
}
export interface UATimer extends UARecipeElement, UATimer_Base {}