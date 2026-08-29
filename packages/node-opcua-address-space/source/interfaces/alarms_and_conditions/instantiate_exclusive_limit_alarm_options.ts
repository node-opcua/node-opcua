import type { InstallSetPointOptions } from "./install_setpoint_options.js";
import type { InstantiateLimitAlarmOptions } from "./instantiate_limit_alarm_options.js";

export interface InstantiateExclusiveLimitAlarmOptions extends InstantiateLimitAlarmOptions, InstallSetPointOptions {
    /** empty interface */
}
