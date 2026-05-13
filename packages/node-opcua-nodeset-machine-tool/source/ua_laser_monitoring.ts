import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { EnumLaserState } from "./enum_laser_state";
import type { UAWorkingUnitMonitoring, UAWorkingUnitMonitoring_Base } from "./ua_working_unit_monitoring";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |LaserMonitoringType i=36                                    |
 * |isAbstract      |false                                                       |
 */
export interface UALaserMonitoring_Base extends UAWorkingUnitMonitoring_Base {
    controllerIsOn: UABaseDataVariable<boolean, DataType.Boolean>;
    laserState: UABaseDataVariable<EnumLaserState, DataType.Int32>;
}
export interface UALaserMonitoring extends UAWorkingUnitMonitoring, UALaserMonitoring_Base {}