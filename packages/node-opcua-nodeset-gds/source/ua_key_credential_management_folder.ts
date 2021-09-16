// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UAFolder, UAFolder_Base } from "node-opcua-nodeset-ua/source/ua_folder"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/GDS/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |6:KeyCredentialManagementFolderType ns=6;i=55     |
 * |isAbstract      |false                                             |
 */
export interface UAKeyCredentialManagementFolder_Base extends UAFolder_Base {
}
export interface UAKeyCredentialManagementFolder extends UAFolder, UAKeyCredentialManagementFolder_Base {
}