// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UADataSetReaderMessage, UADataSetReaderMessage_Base } from "./ua_data_set_reader_message"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |JsonDataSetReaderMessageType ns=0;i=21130         |
 * |isAbstract      |false                                             |
 */
export interface UAJsonDataSetReaderMessage_Base extends UADataSetReaderMessage_Base {
    networkMessageContentMask: UAProperty<UInt32, /*z*/DataType.UInt32>;
    dataSetMessageContentMask: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAJsonDataSetReaderMessage extends UADataSetReaderMessage, UAJsonDataSetReaderMessage_Base {
}