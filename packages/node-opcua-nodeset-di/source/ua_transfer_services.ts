import type { UAMethod, UAObject } from "node-opcua-address-space-base";

// ----- this file has been automatically generated - do not edit

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
export interface UATransferServices extends UAObject, UATransferServices_Base {}