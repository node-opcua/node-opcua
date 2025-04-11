// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { UAPackageLoading, UAPackageLoading_Base } from "./ua_package_loading"
import { UASoftwareVersion } from "./ua_software_version"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |CachedLoadingType i=171                                     |
 * |isAbstract      |false                                                       |
 */
export interface UACachedLoading_Base extends UAPackageLoading_Base {
    pendingVersion: UASoftwareVersion;
    fallbackVersion?: UASoftwareVersion;
    getUpdateBehavior: UAMethod;
}
export interface UACachedLoading extends UAPackageLoading, UACachedLoading_Base {
}