// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt32, UInt16, UAString } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { UAMachineryItemState_StateMachine } from "node-opcua-nodeset-machinery/source/ua_machinery_item_state_state_machine"
import { UAMachineryOperationModeStateMachine } from "node-opcua-nodeset-machinery/source/ua_machinery_operation_mode_state_machine"
import { UAMachineComponents } from "node-opcua-nodeset-machinery/source/ua_machine_components"
import { EnumLevelDisplayMode } from "node-opcua-nodeset-ia/source/enum_level_display_mode"
import { EnumStacklightOperationMode } from "node-opcua-nodeset-ia/source/enum_stacklight_operation_mode"
import { EnumMachineOperationMode } from "./enum_machine_operation_mode"
import { UAEquipment } from "./ua_equipment"
import { UAMachineToolIdentification } from "./ua_machine_tool_identification"
import { UAMonitoring } from "./ua_monitoring"
import { UANotification } from "./ua_notification"
import { UAProduction } from "./ua_production"
export interface UAMachineTool_machineryBuildingBlocks extends UAFolder { // Object
      machineryItemState?: UAMachineryItemState_StateMachine;
      machineryOperationMode?: UAMachineryOperationModeStateMachine;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:MachineToolType ns=10;i=13                     |
 * |isAbstract      |false                                             |
 */
export interface UAMachineTool_Base {
    components?: UAMachineComponents;
    equipment: UAEquipment;
    identification: UAMachineToolIdentification;
    machineryBuildingBlocks?: UAMachineTool_machineryBuildingBlocks;
    monitoring: UAMonitoring;
    notification: UANotification;
    production: UAProduction;
}
export interface UAMachineTool extends UAObject, UAMachineTool_Base {
}