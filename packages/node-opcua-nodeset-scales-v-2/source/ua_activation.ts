import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { NodeId } from "node-opcua-nodeid";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { DataType } from "node-opcua-variant";

import type { UARecipeElement, UARecipeElement_Base } from "./ua_recipe_element";

// ----- this file has been automatically generated - do not edit

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
export interface UAActivation extends UARecipeElement, UAActivation_Base {}