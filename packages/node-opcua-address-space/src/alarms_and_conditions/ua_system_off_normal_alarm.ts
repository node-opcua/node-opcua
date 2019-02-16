/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { UAOffNormalAlarm } from "./ua_off_normal_alarm";

/**
 *
 * This Condition is used by a Server to indicate that an underlying system that is providing  Alarm information is
 * having a communication problem and that the Server may have invalid or incomplete Condition state in the
 * Subscription.
 *
 */
export class UASystemOffNormalAlarm extends  UAOffNormalAlarm {

}
