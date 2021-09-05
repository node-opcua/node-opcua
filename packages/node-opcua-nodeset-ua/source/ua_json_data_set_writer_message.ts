// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UADataSetWriterMessage, UADataSetWriterMessage_Base } from "./ua_data_set_writer_message"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |JsonDataSetWriterMessageType ns=0;i=21128         |
 * |isAbstract      |false                                             |
 */
export interface UAJsonDataSetWriterMessage_Base extends UADataSetWriterMessage_Base {
    dataSetMessageContentMask: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAJsonDataSetWriterMessage extends UADataSetWriterMessage, UAJsonDataSetWriterMessage_Base {
}