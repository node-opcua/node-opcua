import type { UAString } from "node-opcua-basic-types";
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
 * |typedDefinition |ToolLoadPrognosisType i=4                                   |
 * |isAbstract      |false                                                       |
 */
export interface UAToolLoadPrognosis_Base extends UAPrognosis_Base {
    location: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
    toolIdentifier?: UABaseDataVariable<UAString, DataType.String>;
    toolName?: UABaseDataVariable<UAString, DataType.String>;
}
export interface UAToolLoadPrognosis extends UAPrognosis, UAToolLoadPrognosis_Base {}