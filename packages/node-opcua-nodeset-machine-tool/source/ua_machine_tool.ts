// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt64, UInt32, UInt16, UAString } from "node-opcua-basic-types"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UAFileDirectory } from "node-opcua-nodeset-ua/source/ua_file_directory"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { DTISA95JobOrderAndState } from "node-opcua-nodeset-isa-95-jobcontrol-v-2/source/dt_isa_95_job_order_and_state"
import { DTISA95WorkMaster } from "node-opcua-nodeset-isa-95-jobcontrol-v-2/source/dt_isa_95_work_master"
import { DTISA95JobResponse } from "node-opcua-nodeset-isa-95-jobcontrol-v-2/source/dt_isa_95_job_response"
import { UAJobManagement } from "node-opcua-nodeset-machinery-jobs/source/ua_job_management"
import { UAMachineryItemState_StateMachine } from "node-opcua-nodeset-machinery/source/ua_machinery_item_state_state_machine"
import { UAMachineryOperationCounter } from "node-opcua-nodeset-machinery/source/ua_machinery_operation_counter"
import { UAMachineComponents } from "node-opcua-nodeset-machinery/source/ua_machine_components"
import { EnumLevelDisplayMode } from "node-opcua-nodeset-ia/source/enum_level_display_mode"
import { EnumStacklightOperationMode } from "node-opcua-nodeset-ia/source/enum_stacklight_operation_mode"
import { EnumMachineOperationMode } from "./enum_machine_operation_mode"
import { UAMachineOperationModeStateMachine } from "./ua_machine_operation_mode_state_machine"
import { UAEquipment } from "./ua_equipment"
import { UAMachineToolIdentification } from "./ua_machine_tool_identification"
import { UAMonitoring } from "./ua_monitoring"
import { UANotification } from "./ua_notification"
import { UAProduction } from "./ua_production"
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
export interface UAMachineTool extends UAObject, UAMachineTool_Base {
}