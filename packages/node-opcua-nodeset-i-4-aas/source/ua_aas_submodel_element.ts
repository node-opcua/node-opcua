import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { EnumAASModelingKind } from "./enum_aas_modeling_kind";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/I4AAS/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AASSubmodelElementType i=1009                               |
 * |isAbstract      |true                                                        |
 */
export interface UAAASSubmodelElement_Base {
   // PlaceHolder for $DataSpecification$
   // PlaceHolder for $Qualifier$
    category: UAProperty<UAString, DataType.String>;
    modelingKind: UAProperty<EnumAASModelingKind, DataType.Int32>;
}
export interface UAAASSubmodelElement extends UAObject, UAAASSubmodelElement_Base {}