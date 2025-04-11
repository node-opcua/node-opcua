// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAAnalogUnitRange } from "node-opcua-nodeset-ua/dist/ua_analog_unit_range"
import { UAWorkingUnitMonitoring, UAWorkingUnitMonitoring_Base } from "./ua_working_unit_monitoring"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SpindleMonitoringType i=22                                  |
 * |isAbstract      |false                                                       |
 */
export interface UASpindleMonitoring_Base extends UAWorkingUnitMonitoring_Base {
    isRotating: UABaseDataVariable<boolean, DataType.Boolean>;
    isUsedAsAxis?: UABaseDataVariable<boolean, DataType.Boolean>;
    override?: UAAnalogUnitRange<number, DataType.Double>;
}
export interface UASpindleMonitoring extends UAWorkingUnitMonitoring, UASpindleMonitoring_Base {
}