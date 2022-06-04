// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UInt32 } from "node-opcua-basic-types"
import { DTUserManagement } from "./dt_user_management"
import { DTRange } from "./dt_range"
import { DTArgument } from "./dt_argument"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |UserManagementType ns=0;i=24264                   |
 * |isAbstract      |false                                             |
 */
export interface UAUserManagement_Base {
    users: UAProperty<DTUserManagement[], /*z*/DataType.ExtensionObject>;
    passwordLength: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
    passwordOptions: UAProperty<UInt32, /*z*/DataType.UInt32>;
    passwordRestrictions?: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
    addUser: UAMethod;
    modifyUser: UAMethod;
    removeUser: UAMethod;
    changePassword: UAMethod;
}
export interface UAUserManagement extends UAObject, UAUserManagement_Base {
}