import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UAStatistic, UAStatistic_Base } from "./ua_statistic";

// ----- this file has been automatically generated - do not edit

/**
 * Container for the different statisticvalues. All
 * variables are optional, so that the statistics
 * can be instantiated application-specific. Should
 * be used for application-specific statistics.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FloatingStatisticType i=26                                  |
 * |isAbstract      |false                                                       |
 */
export interface UAFloatingStatistic_Base extends UAStatistic_Base {
    windowNumberOfValues: UAProperty<UInt32, DataType.UInt32>;
}
export interface UAFloatingStatistic extends UAStatistic, UAFloatingStatistic_Base {}