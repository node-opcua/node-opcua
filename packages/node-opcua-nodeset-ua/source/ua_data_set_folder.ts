// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { Guid } from "node-opcua-basic-types"
import { DTConfigurationVersion } from "./dt_configuration_version"
import { DTDataSetMeta } from "./dt_data_set_meta"
import { DTArgument } from "./dt_argument"
import { UAFolder, UAFolder_Base } from "./ua_folder"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |DataSetFolderType ns=0;i=14477                    |
 * |isAbstract      |false                                             |
 */
export interface UADataSetFolder_Base extends UAFolder_Base {
    addPublishedDataItems?: UAMethod;
    addPublishedEvents?: UAMethod;
    addPublishedDataItemsTemplate?: UAMethod;
    addPublishedEventsTemplate?: UAMethod;
    removePublishedDataSet?: UAMethod;
    addDataSetFolder?: UAMethod;
    removeDataSetFolder?: UAMethod;
}
export interface UADataSetFolder extends UAFolder, UADataSetFolder_Base {
}