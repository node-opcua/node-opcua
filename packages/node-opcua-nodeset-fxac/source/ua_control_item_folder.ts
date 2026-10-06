import type { UAProperty } from "node-opcua-address-space-base";
import type { UAFunctionalGroup, UAFunctionalGroup_Base } from "node-opcua-nodeset-di/dist/ua_functional_group.js";
import type { UALockingServices } from "node-opcua-nodeset-di/dist/ua_locking_services.js";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/AC/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ControlItemFolderType i=1011                                |
 * |isAbstract      |false                                                       |
 */
export interface UAControlItemFolder_Base extends UAFunctionalGroup_Base {
    lock: UALockingServices;
    maxInactiveLockTime?: UAProperty<number, DataType.Double>;
}
export interface UAControlItemFolder extends UAFunctionalGroup, UAControlItemFolder_Base {}