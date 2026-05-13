import type { UAString } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { UABaseMaterial, UABaseMaterial_Base } from "./ua_base_material";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/                     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PackagingType i=1017                                        |
 * |isAbstract      |false                                                       |
 */
export interface UAPackaging_Base extends UABaseMaterial_Base {
    cornerProtection: UABaseDataVariable<UAString, DataType.String>;
    perimeterProtection: UABaseDataVariable<UAString, DataType.String>;
    spacer: UABaseDataVariable<UAString, DataType.String>;
}
export interface UAPackaging extends UABaseMaterial, UAPackaging_Base {}