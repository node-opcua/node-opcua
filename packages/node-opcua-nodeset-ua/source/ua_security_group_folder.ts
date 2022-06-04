// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, UAString } from "node-opcua-basic-types"
import { DTArgument } from "./dt_argument"
import { UAFolder, UAFolder_Base } from "./ua_folder"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |SecurityGroupFolderType ns=0;i=15452              |
 * |isAbstract      |false                                             |
 */
export interface UASecurityGroupFolder_Base extends UAFolder_Base {
    addSecurityGroup: UAMethod;
    removeSecurityGroup: UAMethod;
    addSecurityGroupFolder?: UAMethod;
    removeSecurityGroupFolder?: UAMethod;
    supportedSecurityPolicyUris?: UAProperty<UAString[], /*z*/DataType.String>;
}
export interface UASecurityGroupFolder extends UAFolder, UASecurityGroupFolder_Base {
}