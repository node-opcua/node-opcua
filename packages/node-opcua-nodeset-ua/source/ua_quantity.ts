import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

import type { DTAnnotation } from "./dt_annotation";
import type { DTQuantityDimension } from "./dt_quantity_dimension";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |QuantityType i=32475                                        |
 * |isAbstract      |false                                                       |
 */
export interface UAQuantity_Base {
    symbol?: UAProperty<LocalizedText, DataType.LocalizedText>;
    annotation?: UAProperty<DTAnnotation[], DataType.ExtensionObject>;
    conversionService?: UAProperty<UAString, DataType.String>;
    dimension: UAProperty<DTQuantityDimension, DataType.ExtensionObject>;
    serverUnits: UAObject;
}
export interface UAQuantity extends UAObject, UAQuantity_Base {}