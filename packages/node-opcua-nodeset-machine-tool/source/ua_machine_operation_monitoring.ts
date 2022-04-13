// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { EUInformation } from "node-opcua-data-access"
import { UInt32 } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UAFiniteStateVariable } from "node-opcua-nodeset-ua/source/ua_finite_state_variable"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAAnalogUnitRange } from "node-opcua-nodeset-ua/source/ua_analog_unit_range"
import { UAMachineryOperationModeStateMachine } from "node-opcua-nodeset-machinery/source/ua_machinery_operation_mode_state_machine"
import { UAMachineryItemState_StateMachine } from "node-opcua-nodeset-machinery/source/ua_machinery_item_state_state_machine"
import { EnumMaintenanceMode } from "./enum_maintenance_mode"
import { EnumMachineOperationMode } from "./enum_machine_operation_mode"
import { UAObligation } from "./ua_obligation"
export interface UAMachineOperationMonitoring_machineryOperationMode extends Omit<UAMachineryOperationModeStateMachine, "currentState"> { // Object
      currentState: UAFiniteStateVariable<LocalizedText>;
      maintenanceMode?: UABaseDataVariable<EnumMaintenanceMode, /*z*/DataType.Int32>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:MachineOperationMonitoringType ns=10;i=26      |
 * |isAbstract      |false                                             |
 */
export interface UAMachineOperationMonitoring_Base {
    feedOverride?: UAAnalogUnitRange<number, /*z*/DataType.Double>;
    isWarmUp?: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    machineryItemState?: UAMachineryItemState_StateMachine;
    machineryOperationMode?: UAMachineOperationMonitoring_machineryOperationMode;
    obligation?: UAObligation;
    operationMode: UABaseDataVariable<EnumMachineOperationMode, /*z*/DataType.Int32>;
    powerOnDuration?: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
}
export interface UAMachineOperationMonitoring extends UAObject, UAMachineOperationMonitoring_Base {
}