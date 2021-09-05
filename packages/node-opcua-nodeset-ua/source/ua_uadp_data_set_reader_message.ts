// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, UInt16, Guid } from "node-opcua-basic-types"
import { UADataSetReaderMessage, UADataSetReaderMessage_Base } from "./ua_data_set_reader_message"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |UadpDataSetReaderMessageType ns=0;i=21116         |
 * |isAbstract      |false                                             |
 */
export interface UAUadpDataSetReaderMessage_Base extends UADataSetReaderMessage_Base {
    groupVersion: UAProperty<UInt32, /*z*/DataType.UInt32>;
    networkMessageNumber: UAProperty<UInt16, /*z*/DataType.UInt16>;
    dataSetOffset: UAProperty<UInt16, /*z*/DataType.UInt16>;
    dataSetClassId: UAProperty<Guid, /*z*/DataType.Guid>;
    networkMessageContentMask: UAProperty<UInt32, /*z*/DataType.UInt32>;
    dataSetMessageContentMask: UAProperty<UInt32, /*z*/DataType.UInt32>;
    publishingInterval: UAProperty<number, /*z*/DataType.Double>;
    processingOffset: UAProperty<number, /*z*/DataType.Double>;
    receiveOffset: UAProperty<number, /*z*/DataType.Double>;
}
export interface UAUadpDataSetReaderMessage extends UADataSetReaderMessage, UAUadpDataSetReaderMessage_Base {
}