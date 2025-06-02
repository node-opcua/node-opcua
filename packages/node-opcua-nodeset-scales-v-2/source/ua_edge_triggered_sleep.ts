// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UADataItem } from "node-opcua-nodeset-ua/dist/ua_data_item"
import { EnumEdgeOperator } from "./enum_edge_operator"
import { UAConditionSleep, UAConditionSleep_Base } from "./ua_condition_sleep"
/**
 * Represents a condition sleep step in a recipe.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |EdgeTriggeredSleepType i=39                                 |
 * |isAbstract      |false                                                       |
 */
export interface UAEdgeTriggeredSleep_Base extends UAConditionSleep_Base {
    /**
     * conditionMode
     * Defines the type of condition operator that is
     * used.
     */
    conditionMode: UAProperty<EnumEdgeOperator, DataType.Int32>;
    /**
     * targetThresholdValue
     * The target value with which the threshold value
     * is compared.
     */
    targetThresholdValue: UADataItem<boolean, DataType.Boolean>;
}
export interface UAEdgeTriggeredSleep extends Omit<UAConditionSleep, "targetThresholdValue">, UAEdgeTriggeredSleep_Base {
}