import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt16 } from "node-opcua-basic-types";
import type { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Weihenstephan/                  |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |WSBaseDataVariableType i=2001                               |
 * |dataType        |Null                                                        |
 * |dataType Name   |VariantOptions i=0                                          |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAWSBaseDataVariable_Base<T, DT extends DataType>  extends UABaseDataVariable_Base<T, DT> {
    wsTagNumber?: UAProperty<(UInt16 | UInt16[]), DataType.UInt16>;
}
export interface UAWSBaseDataVariable<T, DT extends DataType> extends UABaseDataVariable<T, DT>, UAWSBaseDataVariable_Base<T, DT> {}