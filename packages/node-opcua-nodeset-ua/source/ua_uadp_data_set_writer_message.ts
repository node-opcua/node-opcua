import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt16, UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UADataSetWriterMessage, UADataSetWriterMessage_Base } from "./ua_data_set_writer_message";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |UadpDataSetWriterMessageType i=21111                        |
 * |isAbstract      |false                                                       |
 */
export interface UAUadpDataSetWriterMessage_Base extends UADataSetWriterMessage_Base {
    dataSetMessageContentMask: UAProperty<UInt32, DataType.UInt32>;
    configuredSize: UAProperty<UInt16, DataType.UInt16>;
    networkMessageNumber: UAProperty<UInt16, DataType.UInt16>;
    dataSetOffset: UAProperty<UInt16, DataType.UInt16>;
}
export interface UAUadpDataSetWriterMessage extends UADataSetWriterMessage, UAUadpDataSetWriterMessage_Base {}