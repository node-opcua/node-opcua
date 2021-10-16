/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { NodeId } from "node-opcua-nodeid";
import { NamespacePrivate } from "../namespace_private";
import { UAExclusiveLimitAlarmImpl } from "./ua_exclusive_limit_alarm_impl";

export class UAExclusiveLevelAlarmImpl extends UAExclusiveLimitAlarmImpl {
    public static instantiate(
        namespace: NamespacePrivate,
        type: NodeId | string,
        option: any,
        data: any
    ): UAExclusiveLevelAlarmImpl {
        const addressSpace = namespace.addressSpace;
        return UAExclusiveLimitAlarmImpl.instantiate(namespace, type, option, data) as UAExclusiveLevelAlarmImpl;
    }
}
