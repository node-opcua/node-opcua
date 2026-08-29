import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { EnumAASModelingKind } from "./enum_aas_modeling_kind.js";
import type { UAAASSubmodelElement } from "./ua_aas_submodel_element.js";

// ----- this file has been automatically generated - do not edit

export interface UAAASSubmodel_$SubmodelElement$ extends Omit<UAAASSubmodelElement, "category"|"modelingKind"> { // Object
      category: UAProperty<UAString, DataType.String>;
      idShort: UAProperty<UAString, DataType.String>;
      modelingKind: UAProperty<EnumAASModelingKind, DataType.Int32>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/I4AAS/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AASSubmodelType i=1006                                      |
 * |isAbstract      |false                                                       |
 */
export interface UAAASSubmodel_Base {
   // PlaceHolder for $DataSpecification$
   // PlaceHolder for $Qualifier$
   // PlaceHolder for $SubmodelElement$
    modelingKind: UAProperty<EnumAASModelingKind, DataType.Int32>;
}
export interface UAAASSubmodel extends UAObject, UAAASSubmodel_Base {}