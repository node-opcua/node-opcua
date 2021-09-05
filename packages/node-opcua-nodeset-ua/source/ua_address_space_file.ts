// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { UAFile, UAFile_Base } from "./ua_file"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AddressSpaceFileType ns=0;i=11595                 |
 * |isAbstract      |false                                             |
 */
export interface UAAddressSpaceFile_Base extends UAFile_Base {
    exportNamespace?: UAMethod;
}
export interface UAAddressSpaceFile extends UAFile, UAAddressSpaceFile_Base {
}