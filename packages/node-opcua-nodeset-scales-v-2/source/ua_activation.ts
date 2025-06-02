// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UAString } from "node-opcua-basic-types"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UARecipeElement, UARecipeElement_Base } from "./ua_recipe_element"
/**
 * Represents an activation step in a recipe.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ActivationType i=40                                         |
 * |isAbstract      |false                                                       |
 */
export interface UAActivation_Base extends UARecipeElement_Base {
    /**
     * targetValue
     * Defines the value to be reached of the
     * TargetValue of an aggregate that is referenced by
     * TargetValueId.
     */
    targetValue: UAAnalogUnit<any, any>;
    /**
     * targetValueId
     * Defines a unique Id of the aggregate that is
     * being activated. A list of all possible
     * TargetValueIds is defined in
     * RecipeScaleDeviceType.
     */
    targetValueId: UAProperty<UAString, DataType.String>;
    targetValueNodeId?: UAProperty<NodeId, DataType.NodeId>;
}
export interface UAActivation extends UARecipeElement, UAActivation_Base {
}