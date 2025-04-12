// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { UALockingServices } from "./ua_locking_services"
/**
 * Represents the communication means for Devices
 * that are connected to it.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |NetworkType i=6247                                          |
 * |isAbstract      |false                                                       |
 */
export interface UANetwork_Base {
   // PlaceHolder for $ProfileIdentifier$
    /**
     * lock
     * Used to lock the Network.
     */
    lock?: UALockingServices;
}
export interface UANetwork extends UAObject, UANetwork_Base {
}