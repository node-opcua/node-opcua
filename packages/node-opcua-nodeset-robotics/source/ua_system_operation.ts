// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { QualifiedName } from "node-opcua-data-model"
import { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder"
import { UASystemOperationStateMachine } from "./ua_system_operation_state_machine"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SystemOperationType i=1028                                  |
 * |isAbstract      |false                                                       |
 */
export interface UASystemOperation_Base {
    conditions?: UAFolder;
    defaultInstanceBrowseName: UAProperty<QualifiedName, DataType.QualifiedName>;
    systemOperationStateMachine: UASystemOperationStateMachine;
}
export interface UASystemOperation extends UAObject, UASystemOperation_Base {
}