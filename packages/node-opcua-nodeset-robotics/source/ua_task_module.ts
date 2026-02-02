// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TaskModuleType i=1016                                       |
 * |isAbstract      |false                                                       |
 */
export interface UATaskModule_Base {
    isReferenced?: UAProperty<boolean, DataType.Boolean>;
    name: UAProperty<UAString, DataType.String>;
    version?: UAProperty<UAString, DataType.String>;
}
export interface UATaskModule extends UAObject, UATaskModule_Base {
}