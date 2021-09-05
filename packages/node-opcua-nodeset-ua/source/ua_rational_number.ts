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
export interface UARationalNumber_Base<T extends DTRationalNumber/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.ExtensionObject> {
    numerator: UABaseDataVariable<Int32, /*z*/DataType.Int32>;
    denominator: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
}
export interface UARationalNumber<T extends DTRationalNumber/*j*/> extends UABaseDataVariable<T, /*n*/DataType.ExtensionObject>, UARationalNumber_Base<T /*B*/> {
}