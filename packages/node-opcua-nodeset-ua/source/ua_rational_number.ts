// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UInt32, Int32 } from "node-opcua-basic-types"
import { DTRationalNumber } from "./dt_rational_number"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |RationalNumberType ns=0;i=17709                   |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTRationalNumber ns=0;i=18806                     |
 * |isAbstract      |false                                             |
 */
export interface UARationalNumber_Base<T extends DTRationalNumber>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    numerator: UABaseDataVariable<Int32, DataType.Int32>;
    denominator: UABaseDataVariable<UInt32, DataType.UInt32>;
}
export interface UARationalNumber<T extends DTRationalNumber> extends UABaseDataVariable<T, DataType.ExtensionObject>, UARationalNumber_Base<T> {
}