import { UAEventType } from "node-opcua-address-space-base";
import { NodeId } from "node-opcua-nodeid";
import { 
    UAOffNormalAlarmEx 
} from "../src/alarms_and_conditions/ua_off_normal_alarm_impl";
import { 
    UAAcknowledgeableConditionEx 
} from "./interfaces/alarms_and_conditions/ua_acknowledgeable_condition_ex";
import {
    UAAlarmConditionEx,
} from "./interfaces/alarms_and_conditions/ua_alarm_condition_ex";
import { UAConditionEx } from "./interfaces/alarms_and_conditions/ua_condition_ex";
import { UADiscreteAlarmEx } from "./interfaces/alarms_and_conditions/ua_discrete_alarm_ex";
import { UAExclusiveDeviationAlarmEx } from "./interfaces/alarms_and_conditions/ua_exclusive_deviation_alarm_ex";
import { UAExclusiveLimitAlarmEx } from "./interfaces/alarms_and_conditions/ua_exclusive_limit_alarm_ex";
import { UALimitAlarmEx } from "./interfaces/alarms_and_conditions/ua_limit_alarm_ex";
import { UANonExclusiveDeviationAlarmEx } from "./interfaces/alarms_and_conditions/ua_non_exclusive_deviation_alarm_ex";
import { UANonExclusiveLimitAlarmEx } from "./interfaces/alarms_and_conditions/ua_non_exclusive_limit_alarm_ex";

export interface INamespaceAlarmAndCondition {
    // --- Alarms & Conditions -------------------------------------------------
    instantiateCondition(conditionTypeId: UAEventType | NodeId | string, options: any, data?: any): UAConditionEx;

    instantiateAcknowledgeableCondition(
        conditionTypeId: UAEventType | NodeId | string,
        options: any,
        data?: any
    ): UAAcknowledgeableConditionEx;

    instantiateAlarmCondition(alarmConditionTypeId: UAEventType | NodeId | string, options: any, data?: any): UAAlarmConditionEx;

    instantiateLimitAlarm(limitAlarmTypeId: UAEventType | NodeId | string, options: any, data?: any): UALimitAlarmEx;

    instantiateExclusiveLimitAlarm(
        exclusiveLimitAlarmTypeId: UAEventType | NodeId | string,
        options: any,
        data?: any
    ): UAExclusiveLimitAlarmEx;

    instantiateExclusiveDeviationAlarm(options: any, data?: any): UAExclusiveDeviationAlarmEx;

    instantiateNonExclusiveLimitAlarm(
        nonExclusiveLimitAlarmTypeId: UAEventType | NodeId | string,
        options: any,
        data?: any
    ): UANonExclusiveLimitAlarmEx;

    instantiateNonExclusiveDeviationAlarm(options: any, data?: any): UANonExclusiveDeviationAlarmEx;

    instantiateDiscreteAlarm(discreteAlarmType: UAEventType | NodeId | string, options: any, data?: any): UADiscreteAlarmEx;

    instantiateOffNormalAlarm(options: any, data?: any): UAOffNormalAlarmEx;
}
