// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { UATemporaryFileTransfer, UATemporaryFileTransfer_Base } from "node-opcua-nodeset-ua/dist/ua_temporary_file_transfer"
/**
 * Transfers result data as a file.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Machinery/Result/               |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ResultTransferType i=1003                                   |
 * |isAbstract      |false                                                       |
 */
export interface UAResultTransfer_Base extends UATemporaryFileTransfer_Base {
    generateFileForRead: UAMethod;
}
export interface UAResultTransfer extends Omit<UATemporaryFileTransfer, "generateFileForRead">, UAResultTransfer_Base {
}