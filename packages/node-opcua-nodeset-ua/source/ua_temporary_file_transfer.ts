// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { DTArgument } from "./dt_argument"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |TemporaryFileTransferType ns=0;i=15744            |
 * |isAbstract      |false                                             |
 */
export interface UATemporaryFileTransfer_Base {
    clientProcessingTimeout: UAProperty<number, /*z*/DataType.Double>;
    generateFileForRead: UAMethod;
    generateFileForWrite: UAMethod;
    closeAndCommit: UAMethod;
}
export interface UATemporaryFileTransfer extends UAObject, UATemporaryFileTransfer_Base {
}