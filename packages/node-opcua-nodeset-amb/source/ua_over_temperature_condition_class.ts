import type { UASystemConditionClass, UASystemConditionClass_Base } from "node-opcua-nodeset-ua/dist/ua_system_condition_class";

// ----- this file has been automatically generated - do not edit
/**
 * Over temperature
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AMB/                            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |OverTemperatureConditionClassType i=1004                    |
 * |isAbstract      |true                                                        |
 */
export type UAOverTemperatureConditionClass_Base = UASystemConditionClass_Base;
export interface UAOverTemperatureConditionClass extends UASystemConditionClass, UAOverTemperatureConditionClass_Base {}