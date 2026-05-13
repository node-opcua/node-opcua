import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { QualifiedName } from "node-opcua-data-model";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder";
import type { DataType } from "node-opcua-variant";

import type { UASystemOperationStateMachine } from "./ua_system_operation_state_machine";

// ----- this file has been automatically generated - do not edit

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
export interface UASystemOperation extends UAObject, UASystemOperation_Base {}