import type { LocalizedText } from "node-opcua-data-model";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { UAPrognosis, UAPrognosis_Base } from "./ua_prognosis";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProcessChangeoverPrognosisType i=8                          |
 * |isAbstract      |false                                                       |
 */
export interface UAProcessChangeoverPrognosis_Base extends UAPrognosis_Base {
    activity: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
    location: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
}
export interface UAProcessChangeoverPrognosis extends UAPrognosis, UAProcessChangeoverPrognosis_Base {}