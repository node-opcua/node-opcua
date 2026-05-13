import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { QualifiedName } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |LockingServicesType i=6388                                  |
 * |isAbstract      |false                                                       |
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
export interface UALockingServices extends UAObject, UALockingServices_Base {}