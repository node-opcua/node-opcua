// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt64, UInt32, UInt16, UAString } from "node-opcua-basic-types"
import { DTArgument } from "./dt_argument"
import { UAFolder, UAFolder_Base } from "./ua_folder"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |FileDirectoryType ns=0;i=13353                    |
 * |isAbstract      |false                                             |
 */
export interface UAFileDirectory_Base extends UAFolder_Base {
    createDirectory: UAMethod;
    createFile: UAMethod;
    delete: UAMethod;
    moveOrCopy: UAMethod;
}
export interface UAFileDirectory extends UAFolder, UAFileDirectory_Base {
}