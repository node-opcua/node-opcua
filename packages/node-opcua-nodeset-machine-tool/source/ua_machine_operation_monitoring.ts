// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt64, UInt32 } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAAnalogUnitRange } from "node-opcua-nodeset-ua/dist/ua_analog_unit_range"
import { UAMachineryOperationCounter } from "node-opcua-nodeset-machinery/dist/ua_machinery_operation_counter"
import { UAMachineryItemState_StateMachine } from "node-opcua-nodeset-machinery/dist/ua_machinery_item_state_state_machine"
import { EnumMachineOperationMode } from "./enum_machine_operation_mode"
import { UAMachineOperationModeStateMachine } from "./ua_machine_operation_mode_state_machine"
import { UAObligation } from "./ua_obligation"
export interface UAMachineOperationMonitoring_operationCounters extends Omit<UAMachineryOperationCounter, "powerOnDuration"> { // Object
      partsProducedInLifetime?: UABaseDataVariable<UInt64, DataType.UInt64>;
      /**
       * powerOnDuration
       * PowerOnDuration is the duration the MachineryItem
       * has been powered. The main purpose is to
       * determine the time in which degradation of the
       * MachineryItem occurred. The details, when the
       * time is counted, is implementation-specific.
       * Companion specifications might define specific
       * rules. Typically, when the MachineryItem has
       * supply voltage and the main CPU is running, the
       * time is counted. This may include any kind of
       * sleep mode, but may not include pure Wake on LAN.
       * This value shall only increase during the
       * lifetime of the MachineryItem and shall not be
       * reset when it is restarted. The PowerOnDuration
       * is provided as Duration, i.e., in milliseconds or
       * even fractions of a millisecond. However, the
       * Server is not expected to update the value in
       * such a high frequency, but maybe once a minute or
       * once an hour, depending on the application.
       */
      powerOnDuration: UAProperty<number, DataType.Double>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |MachineOperationMonitoringType i=26                         |
 * |isAbstract      |false                                                       |
 */
export interface UAMachineOperationMonitoring_Base {
    feedOverride?: UAAnalogUnitRange<number, DataType.Double>;
    isWarmUp?: UABaseDataVariable<boolean, DataType.Boolean>;
    machineryItemState?: UAMachineryItemState_StateMachine;
    machineryOperationMode?: UAMachineOperationModeStateMachine;
    obligation?: UAObligation;
    operationCounters?: UAMachineOperationMonitoring_operationCounters;
    operationMode: UABaseDataVariable<EnumMachineOperationMode, DataType.Int32>;
    powerOnDuration?: UABaseDataVariable<UInt32, DataType.UInt32>;
}
export interface UAMachineOperationMonitoring extends UAObject, UAMachineOperationMonitoring_Base {
}