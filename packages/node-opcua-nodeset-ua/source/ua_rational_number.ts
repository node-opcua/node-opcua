import type { Int32, UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { DTRationalNumber } from "./dt_rational_number";
import type { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |RationalNumberType i=17709                                  |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DTRationalNumber i=18806                                    |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UARationalNumber_Base<T extends DTRationalNumber>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    numerator: UABaseDataVariable<Int32, DataType.Int32>;
    denominator: UABaseDataVariable<UInt32, DataType.UInt32>;
}
export interface UARationalNumber<T extends DTRationalNumber> extends UABaseDataVariable<T, DataType.ExtensionObject>, UARationalNumber_Base<T> {}