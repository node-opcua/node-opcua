// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAAnalogUnitRange } from "node-opcua-nodeset-ua/source/ua_analog_unit_range"
import { UAWorkingUnitMonitoring, UAWorkingUnitMonitoring_Base } from "./ua_working_unit_monitoring"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:SpindleMonitoringType ns=10;i=22               |
 * |isAbstract      |false                                             |
 */
export interface UASpindleMonitoring_Base extends UAWorkingUnitMonitoring_Base {
    isRotating: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    isUsedAsAxis?: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    override?: UAAnalogUnitRange<number, /*z*/DataType.Double>;
}
export interface UASpindleMonitoring extends UAWorkingUnitMonitoring, UASpindleMonitoring_Base {
}