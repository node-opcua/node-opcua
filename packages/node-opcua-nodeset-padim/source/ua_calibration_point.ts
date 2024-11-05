// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
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
export interface UACalibrationPoint extends UAObject, UACalibrationPoint_Base {
}