// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { UAFolder, UAFolder_Base } from "./ua_folder"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PubSubKeyPushTargetFolderType i=25346                       |
 * |isAbstract      |false                                                       |
 */
export interface UAPubSubKeyPushTargetFolder_Base extends UAFolder_Base {
   // PlaceHolder for $PushTargetName$
    addPushTarget: UAMethod;
    removePushTarget: UAMethod;
    addPushTargetFolder?: UAMethod;
    removePushTargetFolder?: UAMethod;
   // PlaceHolder for $PushTargetFolderName$
}
export interface UAPubSubKeyPushTargetFolder extends UAFolder, UAPubSubKeyPushTargetFolder_Base {
}