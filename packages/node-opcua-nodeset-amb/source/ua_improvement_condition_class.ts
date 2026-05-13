import type { UAMaintenanceConditionClass, UAMaintenanceConditionClass_Base } from "node-opcua-nodeset-ua/dist/ua_maintenance_condition_class";

// ----- this file has been automatically generated - do not edit
/**
 * An improvement maintenance activity
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AMB/                            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ImprovementConditionClassType i=1018                        |
 * |isAbstract      |true                                                        |
 */
export type UAImprovementConditionClass_Base = UAMaintenanceConditionClass_Base;
export interface UAImprovementConditionClass extends UAMaintenanceConditionClass, UAImprovementConditionClass_Base {}