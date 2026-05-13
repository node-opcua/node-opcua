import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TemporaryFileTransferType i=15744                           |
 * |isAbstract      |false                                                       |
 */
export interface UATemporaryFileTransfer_Base {
    clientProcessingTimeout: UAProperty<number, DataType.Double>;
    generateFileForRead: UAMethod;
    generateFileForWrite: UAMethod;
    closeAndCommit: UAMethod;
   // PlaceHolder for $TransferState$
}
export interface UATemporaryFileTransfer extends UAObject, UATemporaryFileTransfer_Base {}