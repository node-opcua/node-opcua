// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { UAFolder, UAFolder_Base } from "./ua_folder"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SubscribedDataSetFolderType i=23795                         |
 * |isAbstract      |false                                                       |
 */
export interface UASubscribedDataSetFolder_Base extends UAFolder_Base {
   // PlaceHolder for $StandaloneSubscribedDataSetName$
    addSubscribedDataSet?: UAMethod;
    removeSubscribedDataSet?: UAMethod;
    addDataSetFolder?: UAMethod;
    removeDataSetFolder?: UAMethod;
   // PlaceHolder for $SubscribedDataSetFolderName$
}
export interface UASubscribedDataSetFolder extends UAFolder, UASubscribedDataSetFolder_Base {
}