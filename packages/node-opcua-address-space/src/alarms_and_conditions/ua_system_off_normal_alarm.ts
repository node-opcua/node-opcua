/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { NodeId } from "node-opcua-nodeid";

import { Namespace } from "../../source";
import { UAOffNormalAlarm } from "./ua_off_normal_alarm";

/**
 *
 * This Condition is used by a Server to indicate that an underlying system that is providing  Alarm information is
 * having a communication problem and that the Server may have invalid or incomplete Condition state in the
 * Subscription.
 *
 */
export class UASystemOffNormalAlarm extends  UAOffNormalAlarm {

    public static instantiate(
        namespace: Namespace,
        limitAlarmTypeId: string | NodeId,
        options: any,
        data: any
    ): UASystemOffNormalAlarm {
          return UAOffNormalAlarm.instantiate(
            namespace, limitAlarmTypeId, options, data) as UASystemOffNormalAlarm;
    }
}
