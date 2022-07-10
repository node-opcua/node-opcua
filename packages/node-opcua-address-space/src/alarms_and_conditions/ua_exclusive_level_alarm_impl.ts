/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { NodeId } from "node-opcua-nodeid";
import { VariantOptions } from "node-opcua-variant";
import { NamespacePrivate } from "../namespace_private";
import { UAExclusiveLimitAlarmImpl } from "./ua_exclusive_limit_alarm_impl";
import { InstantiateLimitAlarmOptions } from "./ua_limit_alarm_impl";

export class UAExclusiveLevelAlarmImpl extends UAExclusiveLimitAlarmImpl {
    public static instantiate(
        namespace: NamespacePrivate,
        type: NodeId | string,
        options: InstantiateLimitAlarmOptions,
        data?: Record<string, VariantOptions>
    ): UAExclusiveLevelAlarmImpl {
        const addressSpace = namespace.addressSpace;
        return UAExclusiveLimitAlarmImpl.instantiate(namespace, type, options, data) as UAExclusiveLevelAlarmImpl;
    }
}
