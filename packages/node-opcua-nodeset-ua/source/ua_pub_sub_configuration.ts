// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTArgument } from "./dt_argument"
import { UAFile, UAFile_Base } from "./ua_file"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |PubSubConfigurationType ns=0;i=25482              |
 * |isAbstract      |false                                             |
 */
export interface UAPubSubConfiguration_Base extends UAFile_Base {
    reserveIds: UAMethod;
    closeAndUpdate: UAMethod;
}
export interface UAPubSubConfiguration extends UAFile, UAPubSubConfiguration_Base {
}