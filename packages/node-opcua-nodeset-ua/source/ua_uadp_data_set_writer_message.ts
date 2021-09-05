// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, UInt16 } from "node-opcua-basic-types"
import { UADataSetWriterMessage, UADataSetWriterMessage_Base } from "./ua_data_set_writer_message"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |UadpDataSetWriterMessageType ns=0;i=21111         |
 * |isAbstract      |false                                             |
 */
export interface UAUadpDataSetWriterMessage_Base extends UADataSetWriterMessage_Base {
    dataSetMessageContentMask: UAProperty<UInt32, /*z*/DataType.UInt32>;
    configuredSize: UAProperty<UInt16, /*z*/DataType.UInt16>;
    networkMessageNumber: UAProperty<UInt16, /*z*/DataType.UInt16>;
    dataSetOffset: UAProperty<UInt16, /*z*/DataType.UInt16>;
}
export interface UAUadpDataSetWriterMessage extends UADataSetWriterMessage, UAUadpDataSetWriterMessage_Base {
}