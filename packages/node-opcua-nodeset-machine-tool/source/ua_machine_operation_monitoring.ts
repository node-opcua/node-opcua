// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { EUInformation } from "node-opcua-data-access"
import { UInt32 } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UAAnalogUnitRange } from "node-opcua-nodeset-ua/source/ua_analog_unit_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAMachineryItemState_StateMachine } from "node-opcua-nodeset-machinery/source/ua_machinery_item_state_state_machine"
import { EnumMachineOperationMode } from "./enum_machine_operation_mode"
import { UAMachineOperationModeStateMachine } from "./ua_machine_operation_mode_state_machine"
import { UAObligation } from "./ua_obligation"
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
    machineryOperationMode?: UAMachineOperationModeStateMachine;
    obligation?: UAObligation;
    operationMode: UABaseDataVariable<EnumMachineOperationMode, /*z*/DataType.Int32>;
    powerOnDuration?: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
}
export interface UAMachineOperationMonitoring extends UAObject, UAMachineOperationMonitoring_Base {
}