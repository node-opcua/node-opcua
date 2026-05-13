import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { QualifiedName } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { UATaskControlStateMachine } from "./ua_task_control_state_machine";

// ----- this file has been automatically generated - do not edit

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
export interface UATaskControlOperation extends UAObject, UATaskControlOperation_Base {}