// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UATemporaryFileTransfer } from "node-opcua-nodeset-ua/dist/ua_temporary_file_transfer"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { DTRecipeTargetValue } from "./dt_recipe_target_value"
import { DTRecipeThreshold } from "./dt_recipe_threshold"
import { UARecipeManagement } from "./ua_recipe_management"
import { UAScaleDevice, UAScaleDevice_Base } from "./ua_scale_device"
import { UAProductionPreset } from "./ua_production_preset"
import { UAMaterial } from "./ua_material"
export interface UARecipeScale_recipes extends Omit<UARecipeManagement, "addRecipe"|"$Recipe_no$"|"removeRecipe"> { // Object
      addRecipe?: UAMethod;
   // PlaceHolder for $Recipe_no$
      recipeUpload?: UATemporaryFileTransfer;
      removeRecipe?: UAMethod;
}
/**
 * RecipeScaleType represents a recipe scale.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |RecipeScaleType i=7                                         |
 * |isAbstract      |false                                                       |
 */
export interface UARecipeScale_Base extends UAScaleDevice_Base {
    abortRecipe?: UAMethod;
    continueRecipe?: UAMethod;
    /**
     * productionPreset
     * Contains the productions presets.
     */
    productionPreset?: UAProductionPreset;
    /**
     * recipes
     * Defines a folder that contains all recipes.
     * Elements in this folder must have the RecipeType.
     */
    recipes?: UARecipeScale_recipes;
    skipCurrentRecipeElement?: UAMethod;
    startRecipe?: UAMethod;
    stopRecipe?: UAMethod;
    supportedMaterial?: UAMaterial;
    /**
     * supportedTargetValues
     * Defines a list of values that may be set via the
     * recipe.
     */
    supportedTargetValues?: UABaseDataVariable<DTRecipeTargetValue[], DataType.ExtensionObject>;
    /**
     * supportedThresholdValues
     * Defines a list of threshold values that may be
     * used within one recipe.
     */
    supportedThresholdValues?: UABaseDataVariable<DTRecipeThreshold[], DataType.ExtensionObject>;
}
export interface UARecipeScale extends Omit<UAScaleDevice, "productionPreset">, UARecipeScale_Base {
}