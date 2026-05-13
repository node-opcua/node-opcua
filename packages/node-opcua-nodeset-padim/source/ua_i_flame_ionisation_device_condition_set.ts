import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

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
export interface UAIFlameIonisationDeviceConditionSet extends UABaseInterface, UAIFlameIonisationDeviceConditionSet_Base {}