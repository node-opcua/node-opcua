import { NodeIdLike } from "node-opcua-nodeid";
import { InstantiateAlarmConditionOptions } from "./instantiate_alarm_condition_options";

export interface InstantiateOffNormalAlarmOptions extends InstantiateAlarmConditionOptions {
    normalState: NodeIdLike;
}
