import type { UAMethod } from "node-opcua-address-space-base";

import type { UAFile, UAFile_Base } from "./ua_file";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AddressSpaceFileType i=11595                                |
 * |isAbstract      |false                                                       |
 */
export interface UAAddressSpaceFile_Base extends UAFile_Base {
    exportNamespace?: UAMethod;
}
export interface UAAddressSpaceFile extends UAFile, UAAddressSpaceFile_Base {}