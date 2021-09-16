// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
/**
 * Base interface for managing statistical data.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IA/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |9:IStatisticsType ns=9;i=1011                     |
 * |isAbstract      |true                                              |
 */
export interface UAIStatistics_Base extends UABaseInterface_Base {
    resetStatistics?: UAMethod;
    /**
     * startTime
     * Indicates the point in time at which the
     * collection of the statistical data has been
     * started.
     */
    startTime?: UAProperty<Date, /*z*/DataType.DateTime>;
}
export interface UAIStatistics extends UABaseInterface, UAIStatistics_Base {
}