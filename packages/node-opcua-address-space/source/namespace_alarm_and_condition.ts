import { NodeId } from "node-opcua-nodeid";
import { UAEventType } from "node-opcua-address-space-base";
import { VariantOptions } from "node-opcua-variant";

import { UAOffNormalAlarmEx } from "../src/alarms_and_conditions/ua_off_normal_alarm_impl";
import { InstantiateAlarmConditionOptions } from "./interfaces/alarms_and_conditions/instantiate_alarm_condition_options";
import { InstantiateExclusiveLimitAlarmOptions } from "./interfaces/alarms_and_conditions/instantiate_exclusive_limit_alarm_options";
import { InstantiateLimitAlarmOptions } from "./interfaces/alarms_and_conditions/instantiate_limit_alarm_options";
import { InstantiateNonExclusiveDeviationAlarmOptions } from "./interfaces/alarms_and_conditions/instantiate_non_exclusive_deviation_alarm_options";
import { InstantiateOffNormalAlarmOptions } from "./interfaces/alarms_and_conditions/instantiate_off_normal_alarm_options";
import { UAAcknowledgeableConditionEx } from "./interfaces/alarms_and_conditions/ua_acknowledgeable_condition_ex";
import { UAAlarmConditionEx } from "./interfaces/alarms_and_conditions/ua_alarm_condition_ex";
import { UAConditionEx } from "./interfaces/alarms_and_conditions/ua_condition_ex";
import { UADiscreteAlarmEx } from "./interfaces/alarms_and_conditions/ua_discrete_alarm_ex";
import { UAExclusiveDeviationAlarmEx } from "./interfaces/alarms_and_conditions/ua_exclusive_deviation_alarm_ex";
import { UAExclusiveLimitAlarmEx } from "./interfaces/alarms_and_conditions/ua_exclusive_limit_alarm_ex";
import { UALimitAlarmEx } from "./interfaces/alarms_and_conditions/ua_limit_alarm_ex";
import { UANonExclusiveDeviationAlarmEx } from "./interfaces/alarms_and_conditions/ua_non_exclusive_deviation_alarm_ex";
import { UANonExclusiveLimitAlarmEx } from "./interfaces/alarms_and_conditions/ua_non_exclusive_limit_alarm_ex";
import { InstantiateNonExclusiveLimitAlarmOptions } from "./interfaces/alarms_and_conditions/instantiate_non_exclusive_limit_alarm_options";
import { InstantiateExclusiveDeviationAlarmOptions } from "./interfaces/alarms_and_conditions/instantiate_exclusive_deviation_alarm_options";

export interface INamespaceAlarmAndCondition {
    // --- Alarms & Conditions -------------------------------------------------
    instantiateCondition(
        conditionTypeId: UAEventType | NodeId | string,
        options: any,
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
