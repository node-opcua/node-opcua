import type { UAObject } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SoftwareLoadingType i=135                                   |
 * |isAbstract      |true                                                        |
 */
export interface UASoftwareLoading_Base {
    updateKey?: UABaseDataVariable<UAString, DataType.String>;
}
export interface UASoftwareLoading extends UAObject, UASoftwareLoading_Base {}