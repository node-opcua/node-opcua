import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { EnumAASEntityType } from "./enum_aas_entity_type.js";
import type { EnumAASModelingKind } from "./enum_aas_modeling_kind.js";
import type { UAAASReference } from "./ua_aas_reference.js";
import type { UAAASSubmodelElement, UAAASSubmodelElement_Base } from "./ua_aas_submodel_element.js";

// ----- this file has been automatically generated - do not edit

export interface UAAASEntity_$SubmodelElement$ extends Omit<UAAASSubmodelElement, "category"|"modelingKind"> { // Object
      category: UAProperty<UAString, DataType.String>;
      idShort: UAProperty<UAString, DataType.String>;
      modelingKind: UAProperty<EnumAASModelingKind, DataType.Int32>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/I4AAS/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AASEntityType i=1022                                        |
 * |isAbstract      |false                                                       |
 */
export interface UAAASEntity_Base extends UAAASSubmodelElement_Base {
   // PlaceHolder for $SubmodelElement$
    asset?: UAAASReference;
    entityType: UAProperty<EnumAASEntityType, DataType.Int32>;
}
export interface UAAASEntity extends UAAASSubmodelElement, UAAASEntity_Base {}