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
 * |typedDefinition |IFlameIonisationDeviceConditionSetType i=1054               |
 * |isAbstract      |true                                                        |
 */
export interface UAIFlameIonisationDeviceConditionSet_Base extends UABaseInterface_Base {
    blockTemperature?: UAAnalogUnit<number, DataType.Float>;
    catalystTemperature?: UAAnalogUnit<number, DataType.Float>;
    combustionAirPressure?: UAAnalogUnit<number, DataType.Float>;
    fuelGasPressure?: UAAnalogUnit<number, DataType.Float>;
}
export interface UAIFlameIonisationDeviceConditionSet extends UABaseInterface, UAIFlameIonisationDeviceConditionSet_Base {
}