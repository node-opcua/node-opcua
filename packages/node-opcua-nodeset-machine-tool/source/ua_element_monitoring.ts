// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:ElementMonitoringType ns=10;i=23               |
 * |isAbstract      |true                                              |
 */
export interface UAElementMonitoring_Base {
    name: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UAElementMonitoring extends UAObject, UAElementMonitoring_Base {
}