import type { InstallSetPointOptions } from "./install_setpoint_options";
import type { InstantiateLimitAlarmOptions } from "./instantiate_limit_alarm_options";

export interface InstantiateExclusiveDeviationAlarmOptions extends InstantiateLimitAlarmOptions, InstallSetPointOptions {
    /** empty interface */
}
