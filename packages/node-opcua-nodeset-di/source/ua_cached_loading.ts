// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UAPackageLoading, UAPackageLoading_Base } from "./ua_package_loading"
import { UASoftwareVersion } from "./ua_software_version"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |1:CachedLoadingType ns=1;i=171                    |
 * |isAbstract      |false                                             |
 */
export interface UACachedLoading_Base extends UAPackageLoading_Base {
    pendingVersion: UASoftwareVersion;
    fallbackVersion?: UASoftwareVersion;
    getUpdateBehavior: UAMethod;
}
export interface UACachedLoading extends UAPackageLoading, UACachedLoading_Base {
}