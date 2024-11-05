// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UInt32 } from "node-opcua-basic-types"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/source/ua_analog_unit"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IAmperometricSignalConditionSetType i=1064                  |
 * |isAbstract      |true                                                        |
 */
export interface UAIAmperometricSignalConditionSet_Base extends UABaseInterface_Base {
    sensorCleaningsCounter?: UAProperty<UInt32, DataType.UInt32>;
    sensorNextCalibration?: UAAnalogUnit<UInt32, DataType.UInt32>;
    sensorSterilisationsCounter?: UAProperty<UInt32, DataType.UInt32>;
    sensingElementTemperature?: UAAnalogUnit<number, DataType.Float>;
}
export interface UAIAmperometricSignalConditionSet extends UABaseInterface, UAIAmperometricSignalConditionSet_Base {
}