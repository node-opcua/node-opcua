// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { EUInformation } from "node-opcua-data-access"
import { UInt32, UAString } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UAMachineryItemState_StateMachine } from "node-opcua-nodeset-machinery/source/ua_machinery_item_state_state_machine"
import { UAWorkingUnitMonitoring, UAWorkingUnitMonitoring_Base } from "node-opcua-nodeset-machine-tool/source/ua_working_unit_monitoring"
import { DTCyclicProcessValue } from "./dt_cyclic_process_value"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MetalForming/                   |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProcessWorkingUnitType i=1004                               |
 * |isAbstract      |false                                                       |
 */
export interface UAProcessWorkingUnit_Base extends UAWorkingUnitMonitoring_Base {
   // PlaceHolder for $CyclicProcessValue$
   // PlaceHolder for $ProcessValue$
    machineryItemState: UAMachineryItemState_StateMachine;
}
export interface UAProcessWorkingUnit extends UAWorkingUnitMonitoring, UAProcessWorkingUnit_Base {
}