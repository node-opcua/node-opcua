// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAFolder, UAFolder_Base } from "node-opcua-nodeset-ua/dist/ua_folder"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/                     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ManualFolderType i=1041                                     |
 * |isAbstract      |false                                                       |
 */
export interface UAManualFolder_Base extends UAFolder_Base {
   // PlaceHolder for $LocalManuals$
    externalManuals?: UAProperty<UAString[], DataType.String>;
}
export interface UAManualFolder extends UAFolder, UAManualFolder_Base {
}