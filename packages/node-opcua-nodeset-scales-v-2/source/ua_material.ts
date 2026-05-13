import type { UAObject } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

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
export interface UAMaterial extends UAObject, UAMaterial_Base {}