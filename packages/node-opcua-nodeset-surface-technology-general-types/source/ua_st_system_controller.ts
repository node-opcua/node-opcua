import type { UAObject } from "node-opcua-address-space-base";
import type { UAMachineryItemState_StateMachine } from "node-opcua-nodeset-machinery/dist/ua_machinery_item_state_state_machine";
import type { UAMachineryOperationModeStateMachine } from "node-opcua-nodeset-machinery/dist/ua_machinery_operation_mode_state_machine";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder";

// ----- this file has been automatically generated - do not edit

export interface UASTSystemController_machineryBuildingBlocks extends UAFolder { // Object
      machineryItemState?: UAMachineryItemState_StateMachine;
      machineryOperationMode?: UAMachineryOperationModeStateMachine;
}
export interface UASTSystemController_state extends UAFolder { // Object
      machineryItemState?: UAMachineryItemState_StateMachine;
      machineryOperationMode?: UAMachineryOperationModeStateMachine;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/SurfaceTechnology/GeneralTypes/ |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |STSystemControllerType i=1009                               |
 * |isAbstract      |true                                                        |
 */
export interface UASTSystemController_Base {
    machineryBuildingBlocks: UASTSystemController_machineryBuildingBlocks;
    state: UASTSystemController_state;
}
export interface UASTSystemController extends UAObject, UASTSystemController_Base {}