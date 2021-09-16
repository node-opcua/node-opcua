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
 * |typedDefinition |10:PartUnloadPrognosisType ns=10;i=5              |
 * |isAbstract      |false                                             |
 */
export interface UAPartUnloadPrognosis_Base extends UAPrognosis_Base {
    location: UABaseDataVariable<LocalizedText, /*z*/DataType.LocalizedText>;
    partIdentifier?: UABaseDataVariable<UAString, /*z*/DataType.String>;
    partName: UABaseDataVariable<UAString, /*z*/DataType.String>;
    partNodeId?: UABaseDataVariable<NodeId, /*z*/DataType.NodeId>;
}
export interface UAPartUnloadPrognosis extends UAPrognosis, UAPartUnloadPrognosis_Base {
}