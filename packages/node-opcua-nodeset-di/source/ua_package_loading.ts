// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UInt32, UAString } from "node-opcua-basic-types"
import { UATemporaryFileTransfer } from "node-opcua-nodeset-ua/source/ua_temporary_file_transfer"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UASoftwareLoading, UASoftwareLoading_Base } from "./ua_software_loading"
import { UASoftwareVersion } from "./ua_software_version"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |1:PackageLoadingType ns=1;i=137                   |
 * |isAbstract      |true                                              |
 */
export interface UAPackageLoading_Base extends UASoftwareLoading_Base {
    currentVersion: UASoftwareVersion;
    fileTransfer: UATemporaryFileTransfer;
    errorMessage: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
    writeBlockSize?: UAProperty<UInt32, DataType.UInt32>;
}
export interface UAPackageLoading extends UASoftwareLoading, UAPackageLoading_Base {
}