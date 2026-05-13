import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UAFolder, UAFolder_Base } from "node-opcua-nodeset-ua/dist/ua_folder";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

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
export interface UAManualFolder extends UAFolder, UAManualFolder_Base {}