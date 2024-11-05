// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/source/ua_analog_unit"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ITocDeviceConditionSetType i=1053                           |
 * |isAbstract      |true                                                        |
 */
export interface UAITocDeviceConditionSet_Base extends UABaseInterface_Base {
    actualInjectedVolume?: UAAnalogUnit<number, DataType.Float>;
    carrierGasGaugePressure?: UAAnalogUnit<number, DataType.Float>;
    carrierGasVolumeFlow?: UAAnalogUnit<number, DataType.Float>;
    coolerTemperature?: UAAnalogUnit<number, DataType.Float>;
    reactorTemperature?: UAAnalogUnit<number, DataType.Float>;
    referenceInjectionVolume?: UAAnalogUnit<number, DataType.Float>;
    sampleWaterVolumeFlow?: UAAnalogUnit<number, DataType.Float>;
}
export interface UAITocDeviceConditionSet extends UABaseInterface, UAITocDeviceConditionSet_Base {
}