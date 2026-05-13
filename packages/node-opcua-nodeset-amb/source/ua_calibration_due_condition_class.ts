import type { UAMaintenanceConditionClass, UAMaintenanceConditionClass_Base } from "node-opcua-nodeset-ua/dist/ua_maintenance_condition_class";

// ----- this file has been automatically generated - do not edit
/**
 * Calibration is due
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AMB/                            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |CalibrationDueConditionClassType i=1005                     |
 * |isAbstract      |true                                                        |
 */
export type UACalibrationDueConditionClass_Base = UAMaintenanceConditionClass_Base;
export interface UACalibrationDueConditionClass extends UAMaintenanceConditionClass, UACalibrationDueConditionClass_Base {}