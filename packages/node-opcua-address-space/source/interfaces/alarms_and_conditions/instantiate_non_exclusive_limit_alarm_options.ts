import type { InstallSetPointOptions } from "./install_setpoint_options";
import type { InstantiateLimitAlarmOptions } from "./instantiate_limit_alarm_options";

export interface InstantiateNonExclusiveLimitAlarmOptions extends InstantiateLimitAlarmOptions, InstallSetPointOptions {
    /** empty interface */
}
