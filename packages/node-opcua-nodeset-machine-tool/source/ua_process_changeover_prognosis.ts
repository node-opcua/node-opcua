// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAPrognosis, UAPrognosis_Base } from "./ua_prognosis"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:ProcessChangeoverPrognosisType ns=10;i=8       |
 * |isAbstract      |false                                             |
 */
export interface UAProcessChangeoverPrognosis_Base extends UAPrognosis_Base {
    activity: UABaseDataVariable<LocalizedText, /*z*/DataType.LocalizedText>;
    location: UABaseDataVariable<LocalizedText, /*z*/DataType.LocalizedText>;
}
export interface UAProcessChangeoverPrognosis extends UAPrognosis, UAProcessChangeoverPrognosis_Base {
}