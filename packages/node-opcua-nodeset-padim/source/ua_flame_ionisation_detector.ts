// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/source/ua_analog_unit"
import { UAPADIM_deviceConditionSet } from "./ua_padim"
import { UAProcessAnalyser, UAProcessAnalyser_Base } from "./ua_process_analyser"
export interface UAFlameIonisationDetector_deviceConditionSet extends UAPADIM_deviceConditionSet { // Object
      blockTemperature?: UAAnalogUnit<number, DataType.Float>;
      catalystTemperature?: UAAnalogUnit<number, DataType.Float>;
      combustionAirPressure?: UAAnalogUnit<number, DataType.Float>;
      fuelGasPressure?: UAAnalogUnit<number, DataType.Float>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FlameIonisationDetectorType i=1085                          |
 * |isAbstract      |false                                                       |
 */
export interface UAFlameIonisationDetector_Base extends UAProcessAnalyser_Base {
    deviceConditionSet?: UAFlameIonisationDetector_deviceConditionSet;
}
export interface UAFlameIonisationDetector extends Omit<UAProcessAnalyser, "deviceConditionSet">, UAFlameIonisationDetector_Base {
}