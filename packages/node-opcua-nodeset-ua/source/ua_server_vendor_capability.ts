// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |ServerVendorCapabilityType ns=0;i=2137            |
 * |dataType        |Null                                              |
 * |dataType Name   |undefined ns=0;i=0                                |
 * |isAbstract      |true                                              |
 */
export interface UAServerVendorCapability_Base<T, DT extends DataType>  extends UABaseDataVariable_Base<T/*g*/, DT> {
}
export interface UAServerVendorCapability<T, DT extends DataType> extends UABaseDataVariable<T, /*m*/DT>, UAServerVendorCapability_Base<T, DT /*A*/> {
}