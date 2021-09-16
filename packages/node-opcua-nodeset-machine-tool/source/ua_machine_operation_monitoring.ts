// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UInt32 } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UAAnalogUnitRange } from "node-opcua-nodeset-ua/source/ua_analog_unit_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
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
    operationMode: UABaseDataVariable<any, any>;
    powerOnDuration?: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
}
export interface UAMachineOperationMonitoring extends UAObject, UAMachineOperationMonitoring_Base {
}