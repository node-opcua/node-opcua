// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UAPADIM_deviceConditionSet } from "./ua_padim"
import { UAProcessAnalyser, UAProcessAnalyser_Base } from "./ua_process_analyser"
export interface UATocAnalyser_deviceConditionSet extends UAPADIM_deviceConditionSet { // Object
      actualInjectedVolume?: UAAnalogUnit<number, DataType.Float>;
      carrierGasGaugePressure?: UAAnalogUnit<number, DataType.Float>;
      carrierGasVolumeFlow?: UAAnalogUnit<number, DataType.Float>;
      coolerTemperature?: UAAnalogUnit<number, DataType.Float>;
      reactorTemperature?: UAAnalogUnit<number, DataType.Float>;
      referenceInjectionVolume?: UAAnalogUnit<number, DataType.Float>;
      sampleWaterVolumeFlow?: UAAnalogUnit<number, DataType.Float>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TocAnalyserType i=1091                                      |
 * |isAbstract      |false                                                       |
 */
export interface UATocAnalyser_Base extends UAProcessAnalyser_Base {
    deviceConditionSet?: UATocAnalyser_deviceConditionSet;
}
export interface UATocAnalyser extends Omit<UAProcessAnalyser, "deviceConditionSet">, UATocAnalyser_Base {
}