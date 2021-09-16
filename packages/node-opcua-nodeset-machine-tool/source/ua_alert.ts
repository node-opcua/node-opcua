// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { StatusCode } from "node-opcua-status-code"
import { UInt32, UInt16, Int16, UAString } from "node-opcua-basic-types"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UAAlarmCondition, UAAlarmCondition_Base } from "node-opcua-nodeset-ua/source/ua_alarm_condition"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:AlertType ns=10;i=39                           |
 * |isAbstract      |false                                             |
 */
export interface UAAlert_Base extends UAAlarmCondition_Base {
    errorCode: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UAAlert extends UAAlarmCondition, UAAlert_Base {
}