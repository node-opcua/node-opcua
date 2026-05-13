import type { UAString } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { UAPrognosis, UAPrognosis_Base } from "./ua_prognosis";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |UtilityChangePrognosisType i=6                              |
 * |isAbstract      |false                                                       |
 */
export interface UAUtilityChangePrognosis_Base extends UAPrognosis_Base {
    utilityName: UABaseDataVariable<UAString, DataType.String>;
}
export interface UAUtilityChangePrognosis extends UAPrognosis, UAUtilityChangePrognosis_Base {}