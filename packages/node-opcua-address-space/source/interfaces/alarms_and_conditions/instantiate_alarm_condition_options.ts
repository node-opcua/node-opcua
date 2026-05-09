import type { UAVariable } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { InstantiateConditionOptions } from "./instantiate_condition_options";

export interface InstantiateAlarmConditionOptions extends InstantiateConditionOptions {
    maxTimeShelved?: number;
    inputNode: UAVariable | NodeId;
}
