import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

import type { DTRange } from "./dt_range";
import type { DTUserManagement } from "./dt_user_management";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |UserManagementType i=24264                                  |
 * |isAbstract      |false                                                       |
 */
export interface UAUserManagement_Base {
    users: UAProperty<DTUserManagement[], DataType.ExtensionObject>;
    passwordLength: UAProperty<DTRange, DataType.ExtensionObject>;
    passwordOptions: UAProperty<UInt32, DataType.UInt32>;
    passwordRestrictions?: UAProperty<LocalizedText, DataType.LocalizedText>;
    addUser: UAMethod;
    modifyUser: UAMethod;
    removeUser: UAMethod;
    changePassword: UAMethod;
}
export interface UAUserManagement extends UAObject, UAUserManagement_Base {}