import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IGasChromatographDeviceConditionSetType i=1095              |
 * |isAbstract      |true                                                        |
 */
export interface UAIGasChromatographDeviceConditionSet_Base extends UABaseInterface_Base {
    valveName?: UAProperty<LocalizedText[], DataType.LocalizedText>;
    valveSwitchingCyclesCounter?: UAProperty<UInt32[], DataType.UInt32>;
    totalAreaMeasuredPeaks?: UAAnalogUnit<number, DataType.Float>;
    baselineNoise?: UAAnalogUnit<number, DataType.Float>;
}
export interface UAIGasChromatographDeviceConditionSet extends UABaseInterface, UAIGasChromatographDeviceConditionSet_Base {}