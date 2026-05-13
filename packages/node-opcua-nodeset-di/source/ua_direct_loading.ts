import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { UAPackageLoading, UAPackageLoading_Base } from "./ua_package_loading";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |DirectLoadingType i=153                                     |
 * |isAbstract      |false                                                       |
 */
export interface UADirectLoading_Base extends UAPackageLoading_Base {
    updateBehavior: UABaseDataVariable<UInt32, DataType.UInt32>;
    writeTimeout?: UAProperty<number, DataType.Double>;
}
export interface UADirectLoading extends UAPackageLoading, UADirectLoading_Base {}