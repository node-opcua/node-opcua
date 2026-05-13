import type { UAProperty } from "node-opcua-address-space-base";
import type { UACondition, UACondition_Base } from "node-opcua-nodeset-ua/dist/ua_condition";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |InterruptionConditionType i=19                              |
 * |isAbstract      |true                                                        |
 */
export interface UAInterruptionCondition_Base extends UACondition_Base {
    isAutomated: UAProperty<boolean, DataType.Boolean>;
}
export interface UAInterruptionCondition extends UACondition, UAInterruptionCondition_Base {}