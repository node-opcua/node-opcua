// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAProductionProgram, UAProductionProgram_Base } from "./ua_production_program"
import { UAProductionProgramStateMachine } from "./ua_production_program_state_machine"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:ProductionActiveProgramType ns=10;i=32         |
 * |isAbstract      |false                                             |
 */
export interface UAProductionActiveProgram_Base extends UAProductionProgram_Base {
    jobIdentifier?: UABaseDataVariable<UAString, /*z*/DataType.String>;
    jobNodeId?: UABaseDataVariable<NodeId, /*z*/DataType.NodeId>;
    state: UAProductionProgramStateMachine;
}
export interface UAProductionActiveProgram extends Omit<UAProductionProgram, "state">, UAProductionActiveProgram_Base {
}