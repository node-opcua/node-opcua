// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { UAFileDirectory } from "node-opcua-nodeset-ua/dist/ua_file_directory"
import { UASoftwareLoading, UASoftwareLoading_Base } from "./ua_software_loading"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FileSystemLoadingType i=192                                 |
 * |isAbstract      |false                                                       |
 */
export interface UAFileSystemLoading_Base extends UASoftwareLoading_Base {
    fileSystem: UAFileDirectory;
    getUpdateBehavior: UAMethod;
    validateFiles?: UAMethod;
}
export interface UAFileSystemLoading extends UASoftwareLoading, UAFileSystemLoading_Base {
}