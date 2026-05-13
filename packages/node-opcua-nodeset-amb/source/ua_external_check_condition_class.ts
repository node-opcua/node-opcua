import type { UAMaintenanceConditionClass, UAMaintenanceConditionClass_Base } from "node-opcua-nodeset-ua/dist/ua_maintenance_condition_class";

// ----- this file has been automatically generated - do not edit
/**
 * An external check maintenance activity
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AMB/                            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ExternalCheckConditionClassType i=1015                      |
 * |isAbstract      |true                                                        |
 */
export type UAExternalCheckConditionClass_Base = UAMaintenanceConditionClass_Base;
export interface UAExternalCheckConditionClass extends UAMaintenanceConditionClass, UAExternalCheckConditionClass_Base {}