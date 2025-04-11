// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UAAnalogUnitRange } from "node-opcua-nodeset-ua/dist/ua_analog_unit_range"
import { UAAnalogSignalVariable, UAAnalogSignalVariable_Base } from "node-opcua-nodeset-padim/dist/ua_analog_signal_variable"
/**
 * Provides a process value and additional meta data
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Machinery/ProcessValues/        |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |ProcessValueVariableType i=2002                             |
 * |dataType        |Variant                                                     |
 * |dataType Name   |(number | number[]) i=26                                    |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAProcessValueVariable_Base<T, DT extends DataType>  extends UAAnalogSignalVariable_Base<T, DT> {
    /**
     * highHighLimit
     * Defines the absolute high high limit
     */
    highHighLimit?: UAAnalogUnit<any, any>;
    /**
     * highLimit
     * Defines the absolute high limit
     */
    highLimit?: UAAnalogUnit<any, any>;
    /**
     * lowLimit
     * Defines the absolute low limit
     */
    lowLimit?: UAAnalogUnit<any, any>;
    /**
     * lowLowLimit
     * Defines the absolute low low limit
     */
    lowLowLimit?: UAAnalogUnit<any, any>;
    /**
     * percentageValue
     * Provides the process value in percentage.
     */
    percentageValue?: UAAnalogUnitRange<number, DataType.Double>;
}
export interface UAProcessValueVariable<T, DT extends DataType> extends UAAnalogSignalVariable<T, DT>, UAProcessValueVariable_Base<T, DT> {
}