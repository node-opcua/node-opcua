import type { UAString } from "node-opcua-basic-types";
import type { NodeId } from "node-opcua-nodeid";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { UAProductionProgram, UAProductionProgram_Base } from "./ua_production_program";
import type { UAProductionProgramStateMachine } from "./ua_production_program_state_machine";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProductionActiveProgramType i=32                            |
 * |isAbstract      |false                                                       |
 */
export interface UAProductionActiveProgram_Base extends UAProductionProgram_Base {
    jobIdentifier?: UABaseDataVariable<UAString, DataType.String>;
    jobNodeId?: UABaseDataVariable<NodeId, DataType.NodeId>;
    state: UAProductionProgramStateMachine;
}
export interface UAProductionActiveProgram extends Omit<UAProductionProgram, "state">, UAProductionActiveProgram_Base {}