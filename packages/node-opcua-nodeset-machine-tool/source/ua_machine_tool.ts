// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt32, UInt16, UAString } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UAEquipment } from "./ua_equipment"
import { UAMachineToolIdentification } from "./ua_machine_tool_identification"
import { UAMonitoring } from "./ua_monitoring"
import { UANotification } from "./ua_notification"
import { UAProduction } from "./ua_production"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:MachineToolType ns=10;i=13                     |
 * |isAbstract      |false                                             |
 */
export interface UAMachineTool_Base {
    equipment: UAEquipment;
    identification: UAMachineToolIdentification;
    monitoring: UAMonitoring;
    notification: UANotification;
    production: UAProduction;
}
export interface UAMachineTool extends UAObject, UAMachineTool_Base {
}