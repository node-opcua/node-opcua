// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |1:TransferServicesType ns=1;i=6526                |
 * |isAbstract      |false                                             |
 */
export interface UATransferServices_Base {
    transferToDevice: UAMethod;
    transferFromDevice: UAMethod;
    fetchTransferResultData: UAMethod;
}
export interface UATransferServices extends UAObject, UATransferServices_Base {
}