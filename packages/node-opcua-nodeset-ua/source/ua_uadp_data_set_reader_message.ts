import type { UAProperty } from "node-opcua-address-space-base";
import type { Guid, UInt16, UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UADataSetReaderMessage, UADataSetReaderMessage_Base } from "./ua_data_set_reader_message";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |UadpDataSetReaderMessageType i=21116                        |
 * |isAbstract      |false                                                       |
 */
export interface UAUadpDataSetReaderMessage_Base extends UADataSetReaderMessage_Base {
    groupVersion: UAProperty<UInt32, DataType.UInt32>;
    networkMessageNumber: UAProperty<UInt16, DataType.UInt16>;
    dataSetOffset: UAProperty<UInt16, DataType.UInt16>;
    dataSetClassId: UAProperty<Guid, DataType.Guid>;
    networkMessageContentMask: UAProperty<UInt32, DataType.UInt32>;
    dataSetMessageContentMask: UAProperty<UInt32, DataType.UInt32>;
    publishingInterval: UAProperty<number, DataType.Double>;
    processingOffset: UAProperty<number, DataType.Double>;
    receiveOffset: UAProperty<number, DataType.Double>;
}
export interface UAUadpDataSetReaderMessage extends UADataSetReaderMessage, UAUadpDataSetReaderMessage_Base {}