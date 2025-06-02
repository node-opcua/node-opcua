// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
/**
 * Container for the different statisticvalues
 * needed in a Checkweigher.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |StatisticCounterType i=43                                   |
 * |isAbstract      |false                                                       |
 */
export interface UAStatisticCounter_Base {
    /**
     * itemCount
     * Totalized count of measurements within the scope
     * of this statistic.
     */
    itemCount: UABaseDataVariable<any, any>;
    maxValue?: UAAnalogUnit<any, any>;
    /**
     * meanValue
     * Mean value of zone measured within this statistic.
     */
    meanValue?: UAAnalogUnit<any, any>;
    minValue?: UAAnalogUnit<any, any>;
    /**
     * percentageOfTotal
     * Percentage of this statistic in relation to the
     * total. The total is defined as the duration the
     * product is activated within the scale.
     */
    percentageOfTotal?: UAAnalogUnit<any, any>;
    standardDeviation?: UAAnalogUnit<any, any>;
    /**
     * sumWeight
     * Totalized weight of all items in ItemCount.
     */
    sumWeight?: UAAnalogUnit<any, any>;
    /**
     * weighed
     * This flag indicates that the element is
     * considered in the weighed statistic.
     */
    weighed: UAProperty<boolean, DataType.Boolean>;
}
export interface UAStatisticCounter extends UAObject, UAStatisticCounter_Base {
}