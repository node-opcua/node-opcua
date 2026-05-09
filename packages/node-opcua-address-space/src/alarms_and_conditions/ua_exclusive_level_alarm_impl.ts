/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import type { NodeId } from "node-opcua-nodeid";
import type { VariantOptions } from "node-opcua-variant";
import type { InstantiateLimitAlarmOptions } from "../../source/interfaces/alarms_and_conditions/instantiate_limit_alarm_options";
import type { NamespacePrivate } from "../namespace_private";
import { UAExclusiveLimitAlarmImpl, UAExclusiveLimitAlarmImplBase } from "./ua_exclusive_limit_alarm_impl";

export class UAExclusiveLevelAlarmImpl extends UAExclusiveLimitAlarmImpl {
    public static instantiate(
        namespace: NamespacePrivate,
        type: NodeId | string,
        options: InstantiateLimitAlarmOptions,
        data?: Record<string, VariantOptions>
    ): UAExclusiveLevelAlarmImpl {
        const _addressSpace = namespace.addressSpace;
        return UAExclusiveLimitAlarmImplBase.instantiate(namespace, type, options, data) as UAExclusiveLevelAlarmImpl;
    }
}
