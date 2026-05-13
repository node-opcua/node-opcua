import type { UAMethod, UAObject } from "node-opcua-address-space-base";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |RoleSetType i=15607                                         |
 * |isAbstract      |false                                                       |
 */
export interface UARoleSet_Base {
   // PlaceHolder for $RoleName$
    addRole: UAMethod;
    removeRole: UAMethod;
}
export interface UARoleSet extends UAObject, UARoleSet_Base {}