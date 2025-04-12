// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAPrognosis, UAPrognosis_Base } from "./ua_prognosis"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ManualActivityPrognosisType i=10                            |
 * |isAbstract      |false                                                       |
 */
export interface UAManualActivityPrognosis_Base extends UAPrognosis_Base {
    activity: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
}
export interface UAManualActivityPrognosis extends UAPrognosis, UAManualActivityPrognosis_Base {
}