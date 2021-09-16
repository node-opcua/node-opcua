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
    defaultInstanceBrowseName: UAProperty<QualifiedName, /*z*/DataType.QualifiedName>;
    locked: UAProperty<boolean, /*z*/DataType.Boolean>;
    lockingClient: UAProperty<UAString, /*z*/DataType.String>;
    lockingUser: UAProperty<UAString, /*z*/DataType.String>;
    remainingLockTime: UAProperty<number, /*z*/DataType.Double>;
    initLock: UAMethod;
    renewLock: UAMethod;
    exitLock: UAMethod;
    breakLock: UAMethod;
}
export interface UALockingServices extends UAObject, UALockingServices_Base {
}