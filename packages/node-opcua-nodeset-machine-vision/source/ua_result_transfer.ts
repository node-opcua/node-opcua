// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UATemporaryFileTransfer, UATemporaryFileTransfer_Base } from "node-opcua-nodeset-ua/source/ua_temporary_file_transfer"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision         |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |4:ResultTransferType ns=4;i=1039                  |
 * |isAbstract      |false                                             |
 */
export interface UAResultTransfer_Base extends UATemporaryFileTransfer_Base {
    generateFileForRead: UAMethod;
}
export interface UAResultTransfer extends Omit<UATemporaryFileTransfer, "generateFileForRead">, UAResultTransfer_Base {
}