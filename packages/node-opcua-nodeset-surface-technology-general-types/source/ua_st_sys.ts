import type { UAObject } from "node-opcua-address-space-base";
import type { UAMachineComponents } from "node-opcua-nodeset-machinery/dist/ua_machine_components";
import type { UAMachineIdentification } from "node-opcua-nodeset-machinery/dist/ua_machine_identification";
import type { UAMachineryItemState_StateMachine } from "node-opcua-nodeset-machinery/dist/ua_machinery_item_state_state_machine";
import type { UAMachineryOperationCounter } from "node-opcua-nodeset-machinery/dist/ua_machinery_operation_counter";
import type { UAMachineryOperationModeStateMachine } from "node-opcua-nodeset-machinery/dist/ua_machinery_operation_mode_state_machine";
import type { UAMonitoring } from "node-opcua-nodeset-machinery/dist/ua_monitoring";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder";

// ----- this file has been automatically generated - do not edit

export interface UASTSys_machineryBuildingBlocks extends UAFolder { // Object
      components?: UAMachineComponents;
      identification?: UAMachineIdentification;
      machineryItemState?: UAMachineryItemState_StateMachine;
      machineryOperationMode?: UAMachineryOperationModeStateMachine;
      monitoring?: UAMonitoring;
      operationCounters?: UAMachineryOperationCounter;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/SurfaceTechnology/GeneralTypes/ |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |STSysType i=1003                                            |
 * |isAbstract      |true                                                        |
 */
export interface UASTSys_Base {
    components?: UAMachineComponents;
    "$description"?: UAFolder;
    identification?: UAMachineIdentification;
    machineryBuildingBlocks: UASTSys_machineryBuildingBlocks;
    monitoring?: UAMonitoring;
}
export interface UASTSys extends UAObject, UASTSys_Base {}