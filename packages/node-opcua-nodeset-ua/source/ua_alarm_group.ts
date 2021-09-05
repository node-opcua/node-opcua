// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { StatusCode } from "node-opcua-status-code"
import { UInt32, UInt16, Int16, UAString } from "node-opcua-basic-types"
import { DTTimeZone } from "./dt_time_zone"
import { DTArgument } from "./dt_argument"
import { UAFolder, UAFolder_Base } from "./ua_folder"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AlarmGroupType ns=0;i=16405                       |
 * |isAbstract      |false                                             |
 */
export interface UAAlarmGroup_Base extends UAFolder_Base {
}
export interface UAAlarmGroup extends UAFolder, UAAlarmGroup_Base {
}