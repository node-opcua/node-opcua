import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { EnumAASValueType } from "./enum_aas_value_type";
import type { UAAASReference } from "./ua_aas_reference";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/I4AAS/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AASQualifierType i=1032                                     |
 * |isAbstract      |false                                                       |
 */
export interface UAAASQualifier_Base {
    type: UAProperty<UAString, DataType.String>;
    value?: UAProperty<any, any>;
    valueId?: UAAASReference;
    valueType: UAProperty<EnumAASValueType, DataType.Int32>;
}
export interface UAAASQualifier extends UAObject, UAAASQualifier_Base {}