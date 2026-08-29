import type { UAEventType } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { VariantOptions } from "node-opcua-variant";
import type { UAOffNormalAlarmEx } from "../src/alarms_and_conditions/ua_off_normal_alarm_impl.js";
import type { InstantiateAlarmConditionOptions } from "./interfaces/alarms_and_conditions/instantiate_alarm_condition_options.js";
import type { InstantiateConditionOptions } from "./interfaces/alarms_and_conditions/instantiate_condition_options.js";
import type { InstantiateExclusiveDeviationAlarmOptions } from "./interfaces/alarms_and_conditions/instantiate_exclusive_deviation_alarm_options.js";
import type { InstantiateExclusiveLimitAlarmOptions } from "./interfaces/alarms_and_conditions/instantiate_exclusive_limit_alarm_options.js";
import type { InstantiateLimitAlarmOptions } from "./interfaces/alarms_and_conditions/instantiate_limit_alarm_options.js";
import type { InstantiateNonExclusiveDeviationAlarmOptions } from "./interfaces/alarms_and_conditions/instantiate_non_exclusive_deviation_alarm_options.js";
import type { InstantiateNonExclusiveLimitAlarmOptions } from "./interfaces/alarms_and_conditions/instantiate_non_exclusive_limit_alarm_options.js";
import type { InstantiateOffNormalAlarmOptions } from "./interfaces/alarms_and_conditions/instantiate_off_normal_alarm_options.js";
import type { UAAcknowledgeableConditionEx } from "./interfaces/alarms_and_conditions/ua_acknowledgeable_condition_ex.js";
import type { UAAlarmConditionEx } from "./interfaces/alarms_and_conditions/ua_alarm_condition_ex.js";
import type { UAConditionEx } from "./interfaces/alarms_and_conditions/ua_condition_ex.js";
import type { UADiscreteAlarmEx } from "./interfaces/alarms_and_conditions/ua_discrete_alarm_ex.js";
import type { UAExclusiveDeviationAlarmEx } from "./interfaces/alarms_and_conditions/ua_exclusive_deviation_alarm_ex.js";
import type { UAExclusiveLimitAlarmEx } from "./interfaces/alarms_and_conditions/ua_exclusive_limit_alarm_ex.js";
import type { UALimitAlarmEx } from "./interfaces/alarms_and_conditions/ua_limit_alarm_ex.js";
import type { UANonExclusiveDeviationAlarmEx } from "./interfaces/alarms_and_conditions/ua_non_exclusive_deviation_alarm_ex.js";
import type { UANonExclusiveLimitAlarmEx } from "./interfaces/alarms_and_conditions/ua_non_exclusive_limit_alarm_ex.js";

export interface INamespaceAlarmAndCondition {
    // --- Alarms & Conditions -------------------------------------------------
    instantiateCondition(
        conditionTypeId: UAEventType | NodeId | string,
        options: InstantiateConditionOptions,
        data?: Record<string, VariantOptions>
    ): UAConditionEx;

    instantiateAcknowledgeableCondition(
        conditionTypeId: UAEventType | NodeId | string,
        options: InstantiateAlarmConditionOptions,
        data?: Record<string, VariantOptions>
    ): UAAcknowledgeableConditionEx;

    instantiateAlarmCondition(
        alarmConditionTypeId: UAEventType | NodeId | string,
        options: InstantiateAlarmConditionOptions,
        data?: Record<string, VariantOptions>
    ): UAAlarmConditionEx;

    instantiateLimitAlarm(
        limitAlarmTypeId: UAEventType | NodeId | string,
        options: InstantiateLimitAlarmOptions,
        data?: Record<string, VariantOptions>
    ): UALimitAlarmEx;

    instantiateExclusiveLimitAlarm(
        exclusiveLimitAlarmTypeId: UAEventType | NodeId | string,
        options: InstantiateExclusiveLimitAlarmOptions,
        data?: Record<string, VariantOptions>
    ): UAExclusiveLimitAlarmEx;

    instantiateExclusiveDeviationAlarm(
        options: InstantiateExclusiveDeviationAlarmOptions,
        data?: Record<string, VariantOptions>
    ): UAExclusiveDeviationAlarmEx;

    instantiateNonExclusiveLimitAlarm(
        nonExclusiveLimitAlarmTypeId: UAEventType | NodeId | string,
        options: InstantiateNonExclusiveLimitAlarmOptions,
        data?: Record<string, VariantOptions>
    ): UANonExclusiveLimitAlarmEx;

    instantiateNonExclusiveDeviationAlarm(
        options: InstantiateNonExclusiveDeviationAlarmOptions,
        data?: Record<string, VariantOptions>
    ): UANonExclusiveDeviationAlarmEx;

    instantiateDiscreteAlarm(
        discreteAlarmType: UAEventType | NodeId | string,
        options: InstantiateAlarmConditionOptions,
        data?: Record<string, VariantOptions>
    ): UADiscreteAlarmEx;

    instantiateOffNormalAlarm(options: InstantiateOffNormalAlarmOptions, data?: Record<string, VariantOptions>): UAOffNormalAlarmEx;
}
