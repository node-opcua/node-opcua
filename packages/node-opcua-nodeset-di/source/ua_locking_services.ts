// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { QualifiedName } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
/**
 * An interface for Locking.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |1:LockingServicesType ns=1;i=6388                 |
 * |isAbstract      |false                                             |
 */
export interface UALockingServices_Base {
    defaultInstanceBrowseName: UAProperty<QualifiedName, DataType.QualifiedName>;
    locked: UAProperty<boolean, DataType.Boolean>;
    lockingClient: UAProperty<UAString, DataType.String>;
    lockingUser: UAProperty<UAString, DataType.String>;
    remainingLockTime: UAProperty<number, DataType.Double>;
    initLock: UAMethod;
    renewLock: UAMethod;
    exitLock: UAMethod;
    breakLock: UAMethod;
}
export interface UALockingServices extends UAObject, UALockingServices_Base {
}