import type { UAMethod, UAObject } from "node-opcua-address-space-base";
import type { UAJobManagement } from "node-opcua-nodeset-machinery-jobs/dist/ua_job_management";
import type { UAMachineComponents } from "node-opcua-nodeset-machinery/dist/ua_machine_components";
import type { UAMachineryItemState_StateMachine } from "node-opcua-nodeset-machinery/dist/ua_machinery_item_state_state_machine";
import type { UAMachineryOperationCounter } from "node-opcua-nodeset-machinery/dist/ua_machinery_operation_counter";
import type { UAFileDirectory } from "node-opcua-nodeset-ua/dist/ua_file_directory";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder";

import type { UAEquipment } from "./ua_equipment";
import type { UAMachineOperationModeStateMachine } from "./ua_machine_operation_mode_state_machine";
import type { UAMachineToolIdentification } from "./ua_machine_tool_identification";
import type { UAMonitoring } from "./ua_monitoring";
import type { UANotification } from "./ua_notification";
import type { UAProduction } from "./ua_production";

// ----- this file has been automatically generated - do not edit

export interface UAMachineTool_fileSystem extends Omit<UAFileDirectory, "createDirectory"|"createFile"|"delete"|"moveOrCopy"> { // Object
      createDirectory: UAMethod;
      createFile: UAMethod;
      delete: UAMethod;
      moveOrCopy: UAMethod;
      workMasters?: UAFileDirectory;
}
export interface UAMachineTool_machineryBuildingBlocks extends UAFolder { // Object
      jobManagement?: UAJobManagement;
      machineryItemState?: UAMachineryItemState_StateMachine;
      machineryOperationMode?: UAMachineOperationModeStateMachine;
      operationCounters?: UAMachineryOperationCounter;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |MachineToolType i=13                                        |
 * |isAbstract      |false                                                       |
 */
export interface UAMachineTool_Base {
    components?: UAMachineComponents;
    equipment: UAEquipment;
    fileSystem?: UAMachineTool_fileSystem;
    identification: UAMachineToolIdentification;
    machineryBuildingBlocks?: UAMachineTool_machineryBuildingBlocks;
    monitoring: UAMonitoring;
    notification: UANotification;
    production: UAProduction;
}
export interface UAMachineTool extends UAObject, UAMachineTool_Base {}