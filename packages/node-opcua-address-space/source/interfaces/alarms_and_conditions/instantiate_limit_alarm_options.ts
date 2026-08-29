// import type { UAVariable } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { UAVariable } from "../../index.js";
import type { InstantiateAlarmConditionOptions } from "./instantiate_alarm_condition_options.js";

export interface InstantiateLimitAlarmOptions extends InstantiateAlarmConditionOptions {
    highHighLimit?: number;
    highLimit: number;
    lowLimit: number;
    lowLowLimit?: number;

    inputNode: UAVariable | NodeId;
}
