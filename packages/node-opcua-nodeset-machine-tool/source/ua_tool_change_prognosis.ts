// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAPrognosis, UAPrognosis_Base } from "./ua_prognosis"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:ToolChangePrognosisType ns=10;i=45             |
 * |isAbstract      |false                                             |
 */
export interface UAToolChangePrognosis_Base extends UAPrognosis_Base {
    location: UABaseDataVariable<LocalizedText, /*z*/DataType.LocalizedText>;
    toolIdentifier?: UABaseDataVariable<UAString, /*z*/DataType.String>;
    toolName?: UABaseDataVariable<UAString, /*z*/DataType.String>;
    toolNodeId?: UABaseDataVariable<NodeId, /*z*/DataType.NodeId>;
}
export interface UAToolChangePrognosis extends UAPrognosis, UAToolChangePrognosis_Base {
}