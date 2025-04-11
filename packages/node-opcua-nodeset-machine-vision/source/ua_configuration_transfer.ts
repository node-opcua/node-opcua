// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { UATemporaryFileTransfer, UATemporaryFileTransfer_Base } from "node-opcua-nodeset-ua/dist/ua_temporary_file_transfer"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision                   |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ConfigurationTransferType i=1012                            |
 * |isAbstract      |false                                                       |
 */
export interface UAConfigurationTransfer_Base extends UATemporaryFileTransfer_Base {
    generateFileForRead: UAMethod;
    generateFileForWrite: UAMethod;
}
export interface UAConfigurationTransfer extends Omit<UATemporaryFileTransfer, "generateFileForRead"|"generateFileForWrite">, UAConfigurationTransfer_Base {
}