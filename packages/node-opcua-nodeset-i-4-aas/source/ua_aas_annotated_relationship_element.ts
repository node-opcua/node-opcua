import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { EnumAASModelingKind } from "./enum_aas_modeling_kind.js";
import type { UAAASRelationshipElement, UAAASRelationshipElement_Base } from "./ua_aas_relationship_element.js";
import type { UAAASSubmodelElement } from "./ua_aas_submodel_element.js";

// ----- this file has been automatically generated - do not edit

export interface UAAASAnnotatedRelationshipElement_$DataElement$ extends Omit<UAAASSubmodelElement, "category"|"modelingKind"> { // Object
      category: UAProperty<UAString, DataType.String>;
      idShort: UAProperty<UAString, DataType.String>;
      modelingKind: UAProperty<EnumAASModelingKind, DataType.Int32>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/I4AAS/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AASAnnotatedRelationshipElementType i=1019                  |
 * |isAbstract      |false                                                       |
 */
export type UAAASAnnotatedRelationshipElement_Base = UAAASRelationshipElement_Base;
export interface UAAASAnnotatedRelationshipElement extends UAAASRelationshipElement, UAAASAnnotatedRelationshipElement_Base {}