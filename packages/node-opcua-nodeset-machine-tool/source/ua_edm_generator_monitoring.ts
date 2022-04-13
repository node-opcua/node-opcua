// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { EnumEDMGeneratorState } from "./enum_edm_generator_state"
import { UAWorkingUnitMonitoring, UAWorkingUnitMonitoring_Base } from "./ua_working_unit_monitoring"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:EDMGeneratorMonitoringType ns=10;i=42          |
 * |isAbstract      |false                                             |
 */
export interface UAEDMGeneratorMonitoring_Base extends UAWorkingUnitMonitoring_Base {
    edMGeneratorState: UABaseDataVariable<EnumEDMGeneratorState, /*z*/DataType.Int32>;
    isOn: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
}
export interface UAEDMGeneratorMonitoring extends UAWorkingUnitMonitoring, UAEDMGeneratorMonitoring_Base {
}