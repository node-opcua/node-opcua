// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAPrognosis, UAPrognosis_Base } from "./ua_prognosis"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:ProductionJobEndPrognosisType ns=10;i=37       |
 * |isAbstract      |false                                             |
 */
export interface UAProductionJobEndPrognosis_Base extends UAPrognosis_Base {
    jobNodeId?: UABaseDataVariable<NodeId, /*z*/DataType.NodeId>;
    sourceIdentifier: UABaseDataVariable<UAString, /*z*/DataType.String>;
}
export interface UAProductionJobEndPrognosis extends UAPrognosis, UAProductionJobEndPrognosis_Base {
}