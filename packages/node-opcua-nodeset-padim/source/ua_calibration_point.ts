import type { UAObject } from "node-opcua-address-space-base";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |CalibrationPointType i=1042                                 |
 * |isAbstract      |false                                                       |
 */
export interface UACalibrationPoint_Base {
    calibrationActualValue?: UABaseDataVariable<(number | number[]), DataType.Float>;
    calibrationSetpoint?: UABaseDataVariable<(number | number[]), DataType.Float>;
}
export interface UACalibrationPoint extends UAObject, UACalibrationPoint_Base {}