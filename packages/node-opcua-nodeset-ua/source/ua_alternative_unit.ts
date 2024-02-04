// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAUnit, UAUnit_Base } from "./ua_unit"
import { DTLinearConversion } from "./dt_linear_conversion"
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
export interface UAAlternativeUnit extends UAUnit, UAAlternativeUnit_Base {
}