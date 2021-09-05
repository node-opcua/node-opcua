// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { StatusCode } from "node-opcua-status-code"
import { UInt64, UInt16, UAString } from "node-opcua-basic-types"
import { DTArgument } from "./dt_argument"
import { UAFolder, UAFolder_Base } from "./ua_folder"
import { UACertificateGroup } from "./ua_certificate_group"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |CertificateGroupFolderType ns=0;i=13813           |
 * |isAbstract      |false                                             |
 */
export interface UACertificateGroupFolder_Base extends UAFolder_Base {
    defaultApplicationGroup: UACertificateGroup;
    defaultHttpsGroup?: UACertificateGroup;
    defaultUserTokenGroup?: UACertificateGroup;
}
export interface UACertificateGroupFolder extends UAFolder, UACertificateGroupFolder_Base {
}