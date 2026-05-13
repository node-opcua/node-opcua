import type { UAMethod } from "node-opcua-address-space-base";
import type { UATemporaryFileTransfer, UATemporaryFileTransfer_Base } from "node-opcua-nodeset-ua/dist/ua_temporary_file_transfer";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision                   |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ResultTransferType i=1039                                   |
 * |isAbstract      |false                                                       |
 */
export interface UAResultTransfer_Base extends UATemporaryFileTransfer_Base {
    generateFileForRead: UAMethod;
}
export interface UAResultTransfer extends Omit<UATemporaryFileTransfer, "generateFileForRead">, UAResultTransfer_Base {}