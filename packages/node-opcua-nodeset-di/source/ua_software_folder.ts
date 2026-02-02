// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAFolder, UAFolder_Base } from "node-opcua-nodeset-ua/dist/ua_folder"
import { EnumSoftwareClass } from "./enum_software_class"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SoftwareFolderType i=364                                    |
 * |isAbstract      |false                                                       |
 */
export interface UASoftwareFolder_Base extends UAFolder_Base {
    softwareClass: UAProperty<EnumSoftwareClass, DataType.Int32>;
    add: UAMethod;
    delete: UAMethod;
}
export interface UASoftwareFolder extends UAFolder, UASoftwareFolder_Base {
}