// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAPrognosis, UAPrognosis_Base } from "./ua_prognosis"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:ToolLoadPrognosisType ns=10;i=4                |
 * |isAbstract      |false                                             |
 */
export interface UAToolLoadPrognosis_Base extends UAPrognosis_Base {
    location: UABaseDataVariable<LocalizedText, /*z*/DataType.LocalizedText>;
    toolIdentifier?: UABaseDataVariable<UAString, /*z*/DataType.String>;
    toolName?: UABaseDataVariable<UAString, /*z*/DataType.String>;
}
export interface UAToolLoadPrognosis extends UAPrognosis, UAToolLoadPrognosis_Base {
}