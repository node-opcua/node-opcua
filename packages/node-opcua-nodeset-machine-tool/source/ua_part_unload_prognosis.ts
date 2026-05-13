import type { UAString } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
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
 * |typedDefinition |PartUnloadPrognosisType i=5                                 |
 * |isAbstract      |false                                                       |
 */
export interface UAPartUnloadPrognosis_Base extends UAPrognosis_Base {
    location: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
    partIdentifier?: UABaseDataVariable<UAString, DataType.String>;
    partName: UABaseDataVariable<UAString, DataType.String>;
    partNodeId?: UABaseDataVariable<NodeId, DataType.NodeId>;
}
export interface UAPartUnloadPrognosis extends UAPrognosis, UAPartUnloadPrognosis_Base {}