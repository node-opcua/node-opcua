// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt16, UAString } from "node-opcua-basic-types"
import { UAProductionProgramStateMachine } from "./ua_production_program_state_machine"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:ProductionProgramType ns=10;i=59               |
 * |isAbstract      |false                                             |
 */
export interface UAProductionProgram_Base {
    name: UAProperty<UAString, /*z*/DataType.String>;
    numberInList: UAProperty<UInt16, /*z*/DataType.UInt16>;
    state?: UAProductionProgramStateMachine;
}
export interface UAProductionProgram extends UAObject, UAProductionProgram_Base {
}