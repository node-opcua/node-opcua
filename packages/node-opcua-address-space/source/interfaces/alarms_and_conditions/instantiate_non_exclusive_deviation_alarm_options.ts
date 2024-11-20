import { InstallSetPointOptions } from "./install_setpoint_options";
import { InstantiateLimitAlarmOptions } from "./instantiate_limit_alarm_options";

export interface InstantiateNonExclusiveDeviationAlarmOptions extends InstantiateLimitAlarmOptions, InstallSetPointOptions {
    /** empty interface */
}
