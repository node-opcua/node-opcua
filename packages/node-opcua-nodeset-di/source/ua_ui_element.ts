// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |UIElementType i=6246                                        |
 * |dataType        |Null                                                        |
 * |dataType Name   |VariantOptions i=0                                          |
 * |value rank      |-1                                                          |
 * |isAbstract      |true                                                        |
 */
export type UAUIElement_Base<T, DT extends DataType> = UABaseDataVariable_Base<T, DT>;
export interface UAUIElement<T, DT extends DataType> extends UABaseDataVariable<T, DT>, UAUIElement_Base<T, DT> {
}