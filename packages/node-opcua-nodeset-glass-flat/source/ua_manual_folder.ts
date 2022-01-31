// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt64, UInt32, UInt16, UAString } from "node-opcua-basic-types"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UAFolder, UAFolder_Base } from "node-opcua-nodeset-ua/source/ua_folder"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/           |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |13:ManualFolderType ns=13;i=1041                  |
 * |isAbstract      |false                                             |
 */
export interface UAManualFolder_Base extends UAFolder_Base {
    externalManuals?: UAProperty<UAString[], /*z*/DataType.String>;
}
export interface UAManualFolder extends UAFolder, UAManualFolder_Base {
}