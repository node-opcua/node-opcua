import type { UAProperty } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { UASystemOffNormalAlarm, UASystemOffNormalAlarm_Base } from "./ua_system_off_normal_alarm";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TrustListOutOfDateAlarmType i=19297                         |
 * |isAbstract      |false                                                       |
 */
export interface UATrustListOutOfDateAlarm_Base extends UASystemOffNormalAlarm_Base {
    trustListId: UAProperty<NodeId, DataType.NodeId>;
    lastUpdateTime: UAProperty<Date, DataType.DateTime>;
    updateFrequency: UAProperty<number, DataType.Double>;
}
export interface UATrustListOutOfDateAlarm extends UASystemOffNormalAlarm, UATrustListOutOfDateAlarm_Base {}