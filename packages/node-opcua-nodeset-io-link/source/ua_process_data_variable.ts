// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { Byte } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IOLink/               |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |17:ProcessDataVariableType ns=17;i=2002           |
 * |dataType        |Null                                              |
 * |dataType Name   |VariantOptions[] ns=0;i=0                         |
 * |isAbstract      |false                                             |
 */
export interface UAProcessDataVariable_Base<T, DT extends DataType>  extends UABaseDataVariable_Base<T, DT> {
    pdDescriptor?: UAProperty<Byte[], DataType.Byte>;
    processDataLength: UAProperty<Byte, DataType.Byte>;
}
export interface UAProcessDataVariable<T, DT extends DataType> extends UABaseDataVariable<T, DT>, UAProcessDataVariable_Base<T, DT> {
}