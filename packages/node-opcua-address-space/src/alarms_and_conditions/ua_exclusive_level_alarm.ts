/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { NodeId } from "node-opcua-nodeid";
import { NamespacePrivate } from "../namespace_private";
import { UAExclusiveLimitAlarm } from "./ua_exclusive_limit_alarm";

/**
 * @class UAExclusiveLevelAlarm
 * @extends UAExclusiveLimitAlarm
 * @constructor
 */
export class UAExclusiveLevelAlarm extends UAExclusiveLimitAlarm {

    public static instantiate(
      namespace: NamespacePrivate,
      type: NodeId | string,
      option: any,
      data: any
    ): UAExclusiveLevelAlarm {
        const addressSpace = namespace.addressSpace;
        return UAExclusiveLimitAlarm.instantiate(namespace, type, option, data) as UAExclusiveLevelAlarm;
    }
}
