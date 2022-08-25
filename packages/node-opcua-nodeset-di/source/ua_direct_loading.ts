// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAPackageLoading, UAPackageLoading_Base } from "./ua_package_loading"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |1:DirectLoadingType ns=1;i=153                    |
 * |isAbstract      |false                                             |
 */
export interface UADirectLoading_Base extends UAPackageLoading_Base {
    updateBehavior: UABaseDataVariable<UInt32, DataType.UInt32>;
    writeTimeout?: UAProperty<number, DataType.Double>;
}
export interface UADirectLoading extends UAPackageLoading, UADirectLoading_Base {
}