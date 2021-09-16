// ----- this file has been automatically generated - do not edit
import { DataType, Variant } from "node-opcua-variant"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAWorkingUnitMonitoring, UAWorkingUnitMonitoring_Base } from "./ua_working_unit_monitoring"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:LaserMonitoringType ns=10;i=36                 |
 * |isAbstract      |false                                             |
 */
export interface UALaserMonitoring_Base extends UAWorkingUnitMonitoring_Base {
    controllerIsOn: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    laserState: UABaseDataVariable<any, any>;
}
export interface UALaserMonitoring extends UAWorkingUnitMonitoring, UALaserMonitoring_Base {
}