// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UInt32 } from "node-opcua-basic-types"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UATemporaryFileTransfer, UATemporaryFileTransfer_Base } from "node-opcua-nodeset-ua/source/ua_temporary_file_transfer"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision         |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |4:ConfigurationTransferType ns=4;i=1012           |
 * |isAbstract      |false                                             |
 */
export interface UAConfigurationTransfer_Base extends UATemporaryFileTransfer_Base {
    generateFileForRead: UAMethod;
    generateFileForWrite: UAMethod;
}
export interface UAConfigurationTransfer extends Omit<UATemporaryFileTransfer, "generateFileForRead"|"generateFileForWrite">, UAConfigurationTransfer_Base {
}