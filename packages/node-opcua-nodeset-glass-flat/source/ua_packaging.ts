// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UABaseMaterial, UABaseMaterial_Base } from "./ua_base_material"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/           |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |13:PackagingType ns=13;i=1017                     |
 * |isAbstract      |false                                             |
 */
export interface UAPackaging_Base extends UABaseMaterial_Base {
    cornerProtection: UABaseDataVariable<UAString, /*z*/DataType.String>;
    perimeterProtection: UABaseDataVariable<UAString, /*z*/DataType.String>;
    spacer: UABaseDataVariable<UAString, /*z*/DataType.String>;
}
export interface UAPackaging extends UABaseMaterial, UAPackaging_Base {
}