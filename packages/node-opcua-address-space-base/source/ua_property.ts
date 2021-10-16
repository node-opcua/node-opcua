import { DataType } from "node-opcua-variant";
import { UAVariableT } from "./ua_variable_t";
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
export interface UAProperty_Base<T, DT extends DataType> {}
export interface UAProperty<T, DT extends DataType> extends UAVariableT<T, /*m*/ DT>, UAProperty_Base<T, DT /*A*/> {}
