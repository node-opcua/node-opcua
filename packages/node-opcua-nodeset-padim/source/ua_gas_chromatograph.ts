// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UInt32 } from "node-opcua-basic-types"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UAPADIM_deviceConditionSet } from "./ua_padim"
import { UAProcessAnalyser, UAProcessAnalyser_Base } from "./ua_process_analyser"
export interface UAGasChromatograph_deviceConditionSet extends UAPADIM_deviceConditionSet { // Object
      valveName?: UAProperty<LocalizedText[], DataType.LocalizedText>;
      valveSwitchingCyclesCounter?: UAProperty<UInt32[], DataType.UInt32>;
      totalAreaMeasuredPeaks?: UAAnalogUnit<number, DataType.Float>;
      baselineNoise?: UAAnalogUnit<number, DataType.Float>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |GasChromatographType i=1096                                 |
 * |isAbstract      |false                                                       |
 */
export interface UAGasChromatograph_Base extends UAProcessAnalyser_Base {
    deviceConditionSet?: UAGasChromatograph_deviceConditionSet;
}
export interface UAGasChromatograph extends Omit<UAProcessAnalyser, "deviceConditionSet">, UAGasChromatograph_Base {
}