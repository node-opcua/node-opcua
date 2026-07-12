import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { EnumAASModelingKind } from "./enum_aas_modeling_kind";
import type { UAAASSubmodelElementCollection, UAAASSubmodelElementCollection_$SubmodelElement$, UAAASSubmodelElementCollection_Base } from "./ua_aas_submodel_element_collection";

// ----- this file has been automatically generated - do not edit

export interface UAAASOrderedSubmodelElementCollection_$SubmodelElement$ extends Omit<UAAASSubmodelElementCollection_$SubmodelElement$, "category"|"modelingKind"> { // Object
      category: UAProperty<UAString, DataType.String>;
      idShort: UAProperty<UAString, DataType.String>;
      modelingKind: UAProperty<EnumAASModelingKind, DataType.Int32>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/I4AAS/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AASOrderedSubmodelElementCollectionType i=1011              |
 * |isAbstract      |false                                                       |
 */
export type UAAASOrderedSubmodelElementCollection_Base = UAAASSubmodelElementCollection_Base;
export interface UAAASOrderedSubmodelElementCollection extends Omit<UAAASSubmodelElementCollection, "$SubmodelElement$">, UAAASOrderedSubmodelElementCollection_Base {}