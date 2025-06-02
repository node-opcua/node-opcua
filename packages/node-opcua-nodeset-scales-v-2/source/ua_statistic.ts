// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UAWeighingItem } from "./ua_weighing_item"
import { UAStatisticCounter } from "./ua_statistic_counter"
/**
 * Container for the different statisticvalues. All
 * variables are optional, so that the statistics
 * can be instantiated application-specific.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |StatisticType i=25                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAStatistic_Base {
    lastItem?: UAWeighingItem;
    /**
     * resetCondition
     * The reason and context for the reset of the
     * statistics, which is done without a trigger from
     * an OPC UA Client, like calling the
     * ResetStatistics Method. ResetCondition is a
     * vendor-specific, human readable string.
     * ResetCondition is non-localized and might contain
     * an expression that can be parsed by certain
     * clients. Examples are: “AFTER 4 HOURS”, “AFTER
     * 1000 ITEMS”, “OPERATOR”. “OPERATOR” means, that
     * an operator resets the statistics on a local HMI.
     */
    resetCondition?: UAProperty<UAString, DataType.String>;
    /**
     * startTime
     * Indicates the point in time at which the
     * collection of the statistical data has been
     * started.
     */
    startTime?: UAProperty<Date, DataType.DateTime>;
    /**
     * tare
     * Defines the last occurring tare value at time of
     * statistic.
     */
    tare?: UAAnalogUnit<number, DataType.Double>;
    /**
     * throughput
     * Defines the number of items registered over
     * period of the statistic.
     */
    throughput?: UAAnalogUnit<any, any>;
    totalPackages?: UAStatisticCounter;
    totalPackagesWeighed?: UAStatisticCounter;
}
export interface UAStatistic extends UAObject, UAStatistic_Base {
}