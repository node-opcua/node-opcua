// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UAIStatistics, UAIStatistics_Base } from "./ua_i_statistics"
/**
 * Base interface for managing statistical data that
 * is rolled over, i.e. only a certain amount of
 * data is considered for statistical data.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IA/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |9:IRollingStatisticsType ns=9;i=1013              |
 * |isAbstract      |true                                              |
 */
export interface UAIRollingStatistics_Base extends UAIStatistics_Base {
    /**
     * windowDuration
     * The duration after the statistical data are
     * rolled over. Only the data that were gathered
     * during that duration are considered for the
     * statistical data, even if the time intervals
     * between the StartTime and the current time is
     * longer.
     */
    windowDuration?: UAProperty<number, /*z*/DataType.Double>;
    /**
     * windowNumberOfValues
     * The number of values before the data gets rolled
     * over. For the statistical data, only the data
     * fitting into the number of values is considered,
     * even if more data were gathered since StartTime.
     */
    windowNumberOfValues?: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAIRollingStatistics extends UAIStatistics, UAIRollingStatistics_Base {
}