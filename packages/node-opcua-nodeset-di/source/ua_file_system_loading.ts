// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt64, UInt32, UInt16, UAString } from "node-opcua-basic-types"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UAFileDirectory } from "node-opcua-nodeset-ua/source/ua_file_directory"
import { UASoftwareLoading, UASoftwareLoading_Base } from "./ua_software_loading"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |1:FileSystemLoadingType ns=1;i=192                |
 * |isAbstract      |false                                             |
 */
export interface UAFileSystemLoading_Base extends UASoftwareLoading_Base {
    fileSystem: UAFileDirectory;
    getUpdateBehavior: UAMethod;
    validateFiles?: UAMethod;
}
export interface UAFileSystemLoading extends UASoftwareLoading, UAFileSystemLoading_Base {
}