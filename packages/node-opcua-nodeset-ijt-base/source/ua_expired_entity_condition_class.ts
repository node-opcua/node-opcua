import type { UABaseConditionClass, UABaseConditionClass_Base } from "node-opcua-nodeset-ua/dist/ua_base_condition_class";

// ----- this file has been automatically generated - do not edit
/**
 * Indicates that an entity is expired.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ExpiredEntityConditionClassType i=1081                      |
 * |isAbstract      |false                                                       |
 */
export type UAExpiredEntityConditionClass_Base = UABaseConditionClass_Base;
export interface UAExpiredEntityConditionClass extends UABaseConditionClass, UAExpiredEntityConditionClass_Base {}