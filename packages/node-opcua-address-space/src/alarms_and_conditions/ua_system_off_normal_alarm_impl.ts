/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { NodeId } from "node-opcua-nodeid";

import { INamespace } from "../../source";
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
        options: any,
        data: any
    ): UASystemOffNormalAlarmImpl {
        return UAOffNormalAlarmImpl.instantiate(namespace, limitAlarmTypeId, options, data) as UASystemOffNormalAlarmImpl;
    }
}
