import { BaseNode } from "node-opcua-address-space-base";
import { NodeId } from "node-opcua-nodeid";
import { InstantiateConditionOptions } from "./instantiate_condition_options";



export interface InstantiateAlarmConditionOptions extends InstantiateConditionOptions {
    maxTimeShelved?: number;
    inputNode: BaseNode | NodeId;
}
