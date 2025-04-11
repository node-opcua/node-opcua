// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { UAFolder, UAFolder_Base } from "./ua_folder"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |DataSetFolderType i=14477                                   |
 * |isAbstract      |false                                                       |
 */
export interface UADataSetFolder_Base extends UAFolder_Base {
   // PlaceHolder for $PublishedDataSetName$
    addPublishedDataItems?: UAMethod;
    addPublishedEvents?: UAMethod;
    addPublishedDataItemsTemplate?: UAMethod;
    addPublishedEventsTemplate?: UAMethod;
    removePublishedDataSet?: UAMethod;
    addDataSetFolder?: UAMethod;
    removeDataSetFolder?: UAMethod;
   // PlaceHolder for $DataSetFolderName$
}
export interface UADataSetFolder extends UAFolder, UADataSetFolder_Base {
}