import type { InstallSetPointOptions } from "./install_setpoint_options.js";
import type { PromoteToAlarmOptions } from "./promote_to_alarm_options.js";

/**
 * The options {@link promoteToLimitAlarm} accepts.
 *
 * A limit left out keeps the value its HighHighLimit / HighLimit / LowLimit / LowLowLimit property
 * already holds. A limit given here overrides that value, and when the node has no property for
 * it the property is added - with its HighHighState / HighState / LowState / LowLowState on a
 * non-exclusive limit alarm.
 *
 * `inputNode` may be left out when the InputNode property of the node already points at a
 * variable of the address space; a limit alarm cannot be promoted without one.
 */
export interface PromoteToLimitAlarmOptions extends PromoteToAlarmOptions, InstallSetPointOptions {
    highHighLimit?: number;
    highLimit?: number;
    lowLimit?: number;
    lowLowLimit?: number;
}
