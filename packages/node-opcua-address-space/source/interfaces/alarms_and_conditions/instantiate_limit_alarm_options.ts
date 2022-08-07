import { UAVariable } from "node-opcua-address-space-base";
import { InstantiateAlarmConditionOptions } from "./instantiate_alarm_condition_options";

export interface InstantiateLimitAlarmOptions extends InstantiateAlarmConditionOptions {
    highHighLimit: number;
    highLimit: number;
    lowLimit: number;
    lowLowLimit: number;
    inputNode: UAVariable;
}
