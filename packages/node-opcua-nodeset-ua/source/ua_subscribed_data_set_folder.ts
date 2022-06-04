// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTDataSetMeta } from "./dt_data_set_meta"
import { DTArgument } from "./dt_argument"
import { UAFolder, UAFolder_Base } from "./ua_folder"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |SubscribedDataSetFolderType ns=0;i=23795          |
 * |isAbstract      |false                                             |
 */
export interface UASubscribedDataSetFolder_Base extends UAFolder_Base {
    addSubscribedDataSet?: UAMethod;
    removeSubscribedDataSet?: UAMethod;
    addDataSetFolder?: UAMethod;
    removeDataSetFolder?: UAMethod;
}
export interface UASubscribedDataSetFolder extends UAFolder, UASubscribedDataSetFolder_Base {
}