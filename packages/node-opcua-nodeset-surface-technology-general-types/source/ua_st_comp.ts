import type { UAObject } from "node-opcua-address-space-base";
import type { UAMachineryComponentIdentification } from "node-opcua-nodeset-machinery/dist/ua_machinery_component_identification";
import type { UAMachineryItemState_StateMachine } from "node-opcua-nodeset-machinery/dist/ua_machinery_item_state_state_machine";
import type { UAMachineryOperationCounter } from "node-opcua-nodeset-machinery/dist/ua_machinery_operation_counter";
import type { UAMachineryOperationModeStateMachine } from "node-opcua-nodeset-machinery/dist/ua_machinery_operation_mode_state_machine";
import type { UAMonitoring } from "node-opcua-nodeset-machinery/dist/ua_monitoring";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder";

// ----- this file has been automatically generated - do not edit

export interface UASTComp_machineryBuildingBlocks extends UAFolder { // Object
      identification?: UAMachineryComponentIdentification;
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
 * |typedDefinition |STCompType i=1006                                           |
 * |isAbstract      |true                                                        |
 */
export interface UASTComp_Base {
    "$description"?: UAFolder;
    identification?: UAMachineryComponentIdentification;
    machineryBuildingBlocks: UASTComp_machineryBuildingBlocks;
    monitoring?: UAMonitoring;
}
export interface UASTComp extends UAObject, UASTComp_Base {}