import type { DataType } from "node-opcua-variant";
import type { UAVariableT } from "./ua_variable_t";
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |PropertyType ns=0;i=68                            |
 * |dataType        |Null                                              |
 * |dataType Name   |undefined ns=0;i=0                                |
 * |isAbstract      |false                                             |
 */
export interface UAProperty_Base<T, DT extends DataType> extends UAVariableT<T, DT> {
    /** A property is a variable that describes an attribute of another variable or object. */
}
export interface UAProperty<T, DT extends DataType> extends UAVariableT<T, /*m*/ DT>, UAProperty_Base<T, DT /*A*/> {}
