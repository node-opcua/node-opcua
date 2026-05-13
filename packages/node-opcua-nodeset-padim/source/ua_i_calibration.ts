import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface";
import type { UAMultiStateDictionaryEntryDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_dictionary_entry_discrete";
import type { DataType } from "node-opcua-variant";

import type { UACalibrationPointSet } from "./ua_calibration_point_set";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ICalibrationType i=1045                                     |
 * |isAbstract      |true                                                        |
 */
export interface UAICalibration_Base extends UABaseInterface_Base {
    calibrationPointSet?: UACalibrationPointSet;
    calibrationTimestamp?: UAProperty<Date, DataType.DateTime>;
    typeOfCalibration?: UAMultiStateDictionaryEntryDiscrete<UInt32, DataType.UInt32>;
}
export interface UAICalibration extends UABaseInterface, UAICalibration_Base {}