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
 * |typedDefinition |ManualActivityPrognosisType i=10                            |
 * |isAbstract      |false                                                       |
 */
export interface UAManualActivityPrognosis_Base extends UAPrognosis_Base {
    activity: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
}
export interface UAManualActivityPrognosis extends UAPrognosis, UAManualActivityPrognosis_Base {}