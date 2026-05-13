import type { UASystemConditionClass, UASystemConditionClass_Base } from "node-opcua-nodeset-ua/dist/ua_system_condition_class";

// ----- this file has been automatically generated - do not edit
/**
 * Configuration is bad
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AMB/                            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |BadConfigurationConditionClassType i=1008                   |
 * |isAbstract      |true                                                        |
 */
export type UABadConfigurationConditionClass_Base = UASystemConditionClass_Base;
export interface UABadConfigurationConditionClass extends UASystemConditionClass, UABadConfigurationConditionClass_Base {}