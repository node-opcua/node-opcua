// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { QualifiedName } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UATaskControlStateMachine } from "./ua_task_control_state_machine"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TaskControlOperationType i=1008                             |
 * |isAbstract      |false                                                       |
 */
export interface UATaskControlOperation_Base {
    defaultInstanceBrowseName: UAProperty<QualifiedName, DataType.QualifiedName>;
    motionDevicesUnderControl?: UAProperty<NodeId[], DataType.NodeId>;
    taskControlStateMachine: UATaskControlStateMachine;
}
export interface UATaskControlOperation extends UAObject, UATaskControlOperation_Base {
}