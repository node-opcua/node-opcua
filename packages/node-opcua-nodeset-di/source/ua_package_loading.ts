import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UATemporaryFileTransfer } from "node-opcua-nodeset-ua/dist/ua_temporary_file_transfer";
import type { DataType } from "node-opcua-variant";

import type { UASoftwareLoading, UASoftwareLoading_Base } from "./ua_software_loading";
import type { UASoftwareVersion } from "./ua_software_version";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PackageLoadingType i=137                                    |
 * |isAbstract      |true                                                        |
 */
export interface UAPackageLoading_Base extends UASoftwareLoading_Base {
    currentVersion: UASoftwareVersion;
    fileTransfer: UATemporaryFileTransfer;
    errorMessage: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
    writeBlockSize?: UAProperty<UInt32, DataType.UInt32>;
}
export interface UAPackageLoading extends UASoftwareLoading, UAPackageLoading_Base {}