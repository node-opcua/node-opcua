import type { UAProperty } from "node-opcua-address-space-base";
import type { UADataItem } from "node-opcua-nodeset-ua/dist/ua_data_item";
import type { DataType } from "node-opcua-variant";

import type { EnumEqualityAndRelationalOperator } from "./enum_equality_and_relational_operator";
import type { UAConditionSleep, UAConditionSleep_Base } from "./ua_condition_sleep";

// ----- this file has been automatically generated - do not edit

/**
 * Represents a condition sleep step in a recipe.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AnalogConditionSleepType i=38                               |
 * |isAbstract      |false                                                       |
 */
export interface UAAnalogConditionSleep_Base extends UAConditionSleep_Base {
    /**
     * conditionMode
     * Defines the type of condition operator that is
     * used.
     */
    conditionMode: UAProperty<EnumEqualityAndRelationalOperator, DataType.Int32>;
    /**
     * targetThresholdValue
     * The target value with which the threshold value
     * is compared.
     */
    targetThresholdValue: UADataItem<any, any>;
}
export interface UAAnalogConditionSleep extends Omit<UAConditionSleep, "targetThresholdValue">, UAAnalogConditionSleep_Base {}