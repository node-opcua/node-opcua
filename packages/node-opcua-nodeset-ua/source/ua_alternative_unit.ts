import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { DTLinearConversion } from "./dt_linear_conversion";
import type { UAUnit, UAUnit_Base } from "./ua_unit";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AlternativeUnitType i=32467                                 |
 * |isAbstract      |false                                                       |
 */
export interface UAAlternativeUnit_Base extends UAUnit_Base {
    linearConversion?: UAProperty<DTLinearConversion, DataType.ExtensionObject>;
    mathMLConversion?: UAProperty<UAString, DataType.String>;
    mathMLInverseConversion?: UAProperty<UAString, DataType.String>;
}
export interface UAAlternativeUnit extends UAUnit, UAAlternativeUnit_Base {}