// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTArgument } from "./dt_argument"
import { UASecurityGroupFolder } from "./ua_security_group_folder"
import { UAPubSubKeyPushTargetFolder } from "./ua_pub_sub_key_push_target_folder"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |PubSubKeyServiceType ns=0;i=15906                 |
 * |isAbstract      |false                                             |
 */
export interface UAPubSubKeyService_Base {
    getSecurityKeys?: UAMethod;
    getSecurityGroup?: UAMethod;
    securityGroups?: UASecurityGroupFolder;
    keyPushTargets?: UAPubSubKeyPushTargetFolder;
}
export interface UAPubSubKeyService extends UAObject, UAPubSubKeyService_Base {
}