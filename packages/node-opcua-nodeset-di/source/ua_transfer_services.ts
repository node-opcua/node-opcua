// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod } from "node-opcua-address-space-base"

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TransferServicesType i=6526                                 |
 * |isAbstract      |false                                                       |
 */
export interface UATransferServices_Base {
    transferToDevice: UAMethod;
    transferFromDevice: UAMethod;
    fetchTransferResultData: UAMethod;
}
export interface UATransferServices extends UAObject, UATransferServices_Base {
}