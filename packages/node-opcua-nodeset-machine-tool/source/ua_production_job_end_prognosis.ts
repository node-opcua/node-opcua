import type { UAString } from "node-opcua-basic-types";
import type { NodeId } from "node-opcua-nodeid";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { UAPrognosis, UAPrognosis_Base } from "./ua_prognosis";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProductionJobEndPrognosisType i=37                          |
 * |isAbstract      |false                                                       |
 */
export interface UAProductionJobEndPrognosis_Base extends UAPrognosis_Base {
    jobNodeId?: UABaseDataVariable<NodeId, DataType.NodeId>;
    sourceIdentifier: UABaseDataVariable<UAString, DataType.String>;
}
export interface UAProductionJobEndPrognosis extends UAPrognosis, UAProductionJobEndPrognosis_Base {}