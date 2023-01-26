// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAIStatistics, UAIStatistics_Base } from "./ua_i_statistics"
/**
 * Base interface for managing statistical data that
 * is not rolled over all data from the start of
 * tracking the statistical data are considered,
 * until the tracking gets reset.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IA/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |9:IAggregateStatisticsType ns=9;i=1012            |
 * |isAbstract      |true                                              |
 */
export interface UAIAggregateStatistics_Base extends UAIStatistics_Base {
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
}
export interface UAIAggregateStatistics extends UAIStatistics, UAIAggregateStatistics_Base {
}