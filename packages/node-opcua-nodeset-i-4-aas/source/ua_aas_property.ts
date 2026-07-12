import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { EnumAASValueType } from "./enum_aas_value_type";
import type { UAAASReference } from "./ua_aas_reference";
import type { UAAASSubmodelElement, UAAASSubmodelElement_Base } from "./ua_aas_submodel_element";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/I4AAS/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AASPropertyType i=1013                                      |
 * |isAbstract      |false                                                       |
 */
export interface UAAASProperty_Base extends UAAASSubmodelElement_Base {
    value?: UAProperty<any, any>;
    valueId?: UAAASReference;
    valueType: UAProperty<EnumAASValueType, DataType.Int32>;
}
export interface UAAASProperty extends UAAASSubmodelElement, UAAASProperty_Base {}