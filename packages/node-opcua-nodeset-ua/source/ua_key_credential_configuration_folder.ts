// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { StatusCode } from "node-opcua-status-code"
import { UAString } from "node-opcua-basic-types"
import { DTArgument } from "./dt_argument"
import { UAFolder, UAFolder_Base } from "./ua_folder"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |KeyCredentialConfigurationFolderType ns=0;i=17496 |
 * |isAbstract      |false                                             |
 */
export interface UAKeyCredentialConfigurationFolder_Base extends UAFolder_Base {
    createCredential?: UAMethod;
}
export interface UAKeyCredentialConfigurationFolder extends UAFolder, UAKeyCredentialConfigurationFolder_Base {
}