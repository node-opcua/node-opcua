import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { EnumAASValueType } from "./enum_aas_value_type.js";
import type { UAAASSubmodelElement, UAAASSubmodelElement_Base } from "./ua_aas_submodel_element.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/I4AAS/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AASRangeType i=1023                                         |
 * |isAbstract      |false                                                       |
 */
export interface UAAASRange_Base extends UAAASSubmodelElement_Base {
    max?: UAProperty<any, any>;
    min?: UAProperty<any, any>;
    valueType: UAProperty<EnumAASValueType, DataType.Int32>;
}
export interface UAAASRange extends UAAASSubmodelElement, UAAASRange_Base {}