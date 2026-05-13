import type { UAProperty } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { UADiscreteAlarm, UADiscreteAlarm_Base } from "./ua_discrete_alarm";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |OffNormalAlarmType i=10637                                  |
 * |isAbstract      |false                                                       |
 */
export interface UAOffNormalAlarm_Base extends UADiscreteAlarm_Base {
    normalState: UAProperty<NodeId, DataType.NodeId>;
}
export interface UAOffNormalAlarm extends UADiscreteAlarm, UAOffNormalAlarm_Base {}