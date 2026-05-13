import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UAAlarmCondition, UAAlarmCondition_Base } from "node-opcua-nodeset-ua/dist/ua_alarm_condition";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AlertType i=39                                              |
 * |isAbstract      |false                                                       |
 */
export interface UAAlert_Base extends UAAlarmCondition_Base {
    errorCode: UAProperty<UAString, DataType.String>;
}
export interface UAAlert extends UAAlarmCondition, UAAlert_Base {}