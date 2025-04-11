// ----- this file has been automatically generated - do not edit
import { UAMachineryItemState_StateMachine } from "node-opcua-nodeset-machinery/dist/ua_machinery_item_state_state_machine"
import { UAWorkingUnitMonitoring, UAWorkingUnitMonitoring_Base } from "node-opcua-nodeset-machine-tool/dist/ua_working_unit_monitoring"

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