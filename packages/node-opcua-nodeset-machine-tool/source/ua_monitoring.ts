// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { UABasicStacklight } from "node-opcua-nodeset-ia/source/ua_basic_stacklight"
import { UAMachineOperationMonitoring } from "./ua_machine_operation_monitoring"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:MonitoringType ns=10;i=14                      |
 * |isAbstract      |false                                             |
 */
export interface UAMonitoring_Base {
    machineTool: UAMachineOperationMonitoring;
    stacklight?: UABasicStacklight;
}
export interface UAMonitoring extends UAObject, UAMonitoring_Base {
}