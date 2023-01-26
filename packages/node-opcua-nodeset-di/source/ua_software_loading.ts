// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |1:SoftwareLoadingType ns=1;i=135                  |
 * |isAbstract      |true                                              |
 */
export interface UASoftwareLoading_Base {
    updateKey?: UABaseDataVariable<UAString, DataType.String>;
}
export interface UASoftwareLoading extends UAObject, UASoftwareLoading_Base {
}