import type { UAMethod, UAProperty } from "node-opcua-address-space-base";
import type { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * Base interface for managing statistical data.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IA/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IStatisticsType i=1011                                      |
 * |isAbstract      |true                                                        |
 */
export interface UAIStatistics_Base extends UABaseInterface_Base {
    resetStatistics?: UAMethod;
    /**
     * startTime
     * Indicates the point in time at which the
     * collection of the statistical data has been
     * started.
     */
    startTime?: UAProperty<Date, DataType.DateTime>;
}
export interface UAIStatistics extends UABaseInterface, UAIStatistics_Base {}