import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { EnumAASModelingKind } from "./enum_aas_modeling_kind";
import type { UAAASSubmodelElement, UAAASSubmodelElement_Base } from "./ua_aas_submodel_element";

// ----- this file has been automatically generated - do not edit

export interface UAAASSubmodelElementCollection_$SubmodelElement$ extends Omit<UAAASSubmodelElement, "category"|"modelingKind"> { // Object
      category: UAProperty<UAString, DataType.String>;
      idShort: UAProperty<UAString, DataType.String>;
      modelingKind: UAProperty<EnumAASModelingKind, DataType.Int32>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/I4AAS/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AASSubmodelElementCollectionType i=1010                     |
 * |isAbstract      |false                                                       |
 */
export interface UAAASSubmodelElementCollection_Base extends UAAASSubmodelElement_Base {
   // PlaceHolder for $SubmodelElement$
    allowDuplicates?: UAProperty<boolean, DataType.Boolean>;
}
export interface UAAASSubmodelElementCollection extends UAAASSubmodelElement, UAAASSubmodelElementCollection_Base {}