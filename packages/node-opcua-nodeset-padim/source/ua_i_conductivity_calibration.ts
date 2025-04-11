// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IConductivityCalibrationType i=1047                         |
 * |isAbstract      |true                                                        |
 */
export interface UAIConductivityCalibration_Base extends UABaseInterface_Base {
    conductivityCellConstant?: UAAnalogUnit<number, DataType.Float>;
}
export interface UAIConductivityCalibration extends UABaseInterface, UAIConductivityCalibration_Base {
}