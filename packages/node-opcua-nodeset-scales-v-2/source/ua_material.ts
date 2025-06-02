// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
/**
 * Represents a material.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |MaterialType i=35                                           |
 * |isAbstract      |false                                                       |
 */
export interface UAMaterial_Base {
    /**
     * materialId
     * Defines a unique identifier for the material.
     */
    materialId: UABaseDataVariable<UAString, DataType.String>;
    /**
     * materialName
     * Defines a user-readable name of the material.
     */
    materialName: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
}
export interface UAMaterial extends UAObject, UAMaterial_Base {
}