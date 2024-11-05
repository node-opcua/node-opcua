// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UAAnalogUnitRange, UAAnalogUnitRange_Base } from "node-opcua-nodeset-ua/source/ua_analog_unit_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |AnalogSignalVariableType i=1111                             |
 * |dataType        |Variant                                                     |
 * |dataType Name   |(number | number[]) i=26                                    |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAAnalogSignalVariable_Base<T, DT extends DataType>  extends UAAnalogUnitRange_Base<T, DT> {
    simulationState?: UABaseDataVariable<boolean, DataType.Boolean>;
    actualValue?: UABaseDataVariable<any, any>;
    simulationValue?: UABaseDataVariable<any, any>;
    damping?: UAProperty<number, DataType.Float>;
    engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
}
export interface UAAnalogSignalVariable<T, DT extends DataType> extends Omit<UAAnalogUnitRange<T, DT>, "engineeringUnits">, UAAnalogSignalVariable_Base<T, DT> {
}