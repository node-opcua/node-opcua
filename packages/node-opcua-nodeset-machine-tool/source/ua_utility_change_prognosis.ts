// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAPrognosis, UAPrognosis_Base } from "./ua_prognosis"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:UtilityChangePrognosisType ns=10;i=6           |
 * |isAbstract      |false                                             |
 */
export interface UAUtilityChangePrognosis_Base extends UAPrognosis_Base {
    utilityName: UABaseDataVariable<UAString, /*z*/DataType.String>;
}
export interface UAUtilityChangePrognosis extends UAPrognosis, UAUtilityChangePrognosis_Base {
}