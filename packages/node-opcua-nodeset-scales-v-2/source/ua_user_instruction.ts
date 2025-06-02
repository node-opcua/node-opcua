// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UARecipeElement, UARecipeElement_Base } from "./ua_recipe_element"
/**
 * UserInstructionType represents a recipe step that
 * requires user interaction. The recipe scale
 * display instruction (a text and/or some
 * application- specific symbols) on an HMI and
 * waits until the user acknowledged the instruction.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |UserInstructionType i=33                                    |
 * |isAbstract      |false                                                       |
 */
export interface UAUserInstruction_Base extends UARecipeElement_Base {
    /**
     * displayText
     * Defines instructions for this RecipeElement that
     * will be displayed to the user.
     */
    displayText: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
    /**
     * instructionId
     * Defines a unique Id used to identify the
     * instruction that is displayed via DisplayText.
     */
    instructionId?: UABaseDataVariable<any, any>;
}
export interface UAUserInstruction extends UARecipeElement, UAUserInstruction_Base {
}