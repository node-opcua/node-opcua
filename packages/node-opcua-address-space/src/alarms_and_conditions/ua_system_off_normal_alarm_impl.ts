/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { INamespace } from "node-opcua-address-space-base";
import { NodeId } from "node-opcua-nodeid";
import { VariantOptions } from "node-opcua-variant";
import { InstantiateOffNormalAlarmOptions } from "../../source/interfaces/alarms_and_conditions/instantiate_off_normal_alarm_options";
import { UAOffNormalAlarmImpl } from "./ua_off_normal_alarm_impl";

/**
 *
 * This Condition is used by a Server to indicate that an underlying system that is providing  Alarm information is
 * having a communication problem and that the Server may have invalid or incomplete Condition state in the
 * Subscription.
 *
 */
export class UASystemOffNormalAlarmImpl extends UAOffNormalAlarmImpl {
    public static instantiate(
        namespace: INamespace,
        limitAlarmTypeId: string | NodeId,
        options: InstantiateOffNormalAlarmOptions,
        data?: Record<string, VariantOptions>
    ): UASystemOffNormalAlarmImpl {
        return UAOffNormalAlarmImpl.instantiate(namespace, limitAlarmTypeId, options, data) as UASystemOffNormalAlarmImpl;
    }
}
