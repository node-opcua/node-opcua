import type { UAString } from "node-opcua-basic-types";
import type { NodeId } from "node-opcua-nodeid";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UADataItem } from "node-opcua-nodeset-ua/dist/ua_data_item";
import type { DataType } from "node-opcua-variant";

import type { UARecipeElement, UARecipeElement_Base } from "./ua_recipe_element";

// ----- this file has been automatically generated - do not edit

/**
 * Represents a condition sleep step in a recipe.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ConditionSleepType i=37                                     |
 * |isAbstract      |true                                                        |
 */
export interface UAConditionSleep_Base extends UARecipeElement_Base {
    /**
     * targetThresholdValue
     * The target value with which the threshold value
     * is compared.
     */
    targetThresholdValue: UADataItem<any, any>;
    /**
     * thresholdValueId
     * Defines an Id of process value that needs to be
     * monitored and is element of the
     * SupportedThresholdValues in the RecipeScale.
     */
    thresholdValueId: UADataItem<UAString, DataType.String>;
    /**
     * thresholdValueNodeId
     * The NodeId of process value that needs to be
     * monitored and is element of the
     * SupportedThresholdValues in the RecipeScale. This
     * variable should be used if the value is part of
     * the address space.
     */
    thresholdValueNodeId?: UABaseDataVariable<NodeId, DataType.NodeId>;
    /**
     * timeout
     * Timeout specifies the duration within the
     * TargetThresholdValue needs to be reached. If
     * Timeout is exceeded and operator intervention is
     * necessary.
     */
    timeout?: UADataItem<number, DataType.Double>;
}
export interface UAConditionSleep extends UARecipeElement, UAConditionSleep_Base {}