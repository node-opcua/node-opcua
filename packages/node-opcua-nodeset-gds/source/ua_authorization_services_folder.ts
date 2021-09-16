// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { DTUserTokenPolicy } from "node-opcua-nodeset-ua/source/dt_user_token_policy"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UAFolder, UAFolder_Base } from "node-opcua-nodeset-ua/source/ua_folder"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/GDS/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |6:AuthorizationServicesFolderType ns=6;i=233      |
 * |isAbstract      |false                                             |
 */
export interface UAAuthorizationServicesFolder_Base extends UAFolder_Base {
}
export interface UAAuthorizationServicesFolder extends UAFolder, UAAuthorizationServicesFolder_Base {
}