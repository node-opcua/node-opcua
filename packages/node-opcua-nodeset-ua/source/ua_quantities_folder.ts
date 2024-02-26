// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { DTAnnotation } from "./dt_annotation"
import { DTQuantityDimension } from "./dt_quantity_dimension"
import { DTLinearConversion } from "./dt_linear_conversion"
import { EnumConversionLimitEnum } from "./enum_conversion_limit_enum"
import { UAFolder, UAFolder_Base } from "./ua_folder"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |QuantitiesFolderType i=32502                                |
 * |isAbstract      |false                                                       |
 */
export type UAQuantitiesFolder_Base = UAFolder_Base;
export interface UAQuantitiesFolder extends UAFolder, UAQuantitiesFolder_Base {
}