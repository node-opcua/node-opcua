import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { UAMultiStateDictionaryEntryDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_dictionary_entry_discrete";
import type { DataType } from "node-opcua-variant";

import type { UAAnalogSignalVariable } from "./ua_analog_signal_variable";
import type { UACalibrationPointSet } from "./ua_calibration_point_set";
import type { UASignal, UASignal_Base } from "./ua_signal";

// ----- this file has been automatically generated - do not edit

export interface UAAnalogSignal_$SignalCalibrationIdentifier$ extends UAObject { // Object
      calibrationTimestamp?: UAProperty<Date, DataType.DateTime>;
      typeOfCalibration?: UAMultiStateDictionaryEntryDiscrete<UInt32, DataType.UInt32>;
      calibrationPointSet?: UACalibrationPointSet;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AnalogSignalType i=1022                                     |
 * |isAbstract      |false                                                       |
 */
export interface UAAnalogSignal_Base extends UASignal_Base {
    zeroPointAdjustment?: UAMethod;
    analogSignal: UAAnalogSignalVariable<any, any>;
   // PlaceHolder for $SignalCalibrationIdentifier$
    signalConditionSet?: UAObject;
}
export interface UAAnalogSignal extends UASignal, UAAnalogSignal_Base {}