// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { EnumDataSetOrdering } from "./enum_data_set_ordering"
import { UAWriterGroupMessage, UAWriterGroupMessage_Base } from "./ua_writer_group_message"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |UadpWriterGroupMessageType ns=0;i=21105           |
 * |isAbstract      |false                                             |
 */
export interface UAUadpWriterGroupMessage_Base extends UAWriterGroupMessage_Base {
    groupVersion: UAProperty<UInt32, /*z*/DataType.UInt32>;
    dataSetOrdering: UAProperty<EnumDataSetOrdering, /*z*/DataType.Int32>;
    networkMessageContentMask: UAProperty<UInt32, /*z*/DataType.UInt32>;
    samplingOffset?: UAProperty<number, /*z*/DataType.Double>;
    publishingOffset: UAProperty<number[], /*z*/DataType.Double>;
}
export interface UAUadpWriterGroupMessage extends UAWriterGroupMessage, UAUadpWriterGroupMessage_Base {
}