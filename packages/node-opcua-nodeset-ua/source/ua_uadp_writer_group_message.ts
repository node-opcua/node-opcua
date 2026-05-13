import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { EnumDataSetOrdering } from "./enum_data_set_ordering";
import type { UAWriterGroupMessage, UAWriterGroupMessage_Base } from "./ua_writer_group_message";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |UadpWriterGroupMessageType i=21105                          |
 * |isAbstract      |false                                                       |
 */
export interface UAUadpWriterGroupMessage_Base extends UAWriterGroupMessage_Base {
    groupVersion: UAProperty<UInt32, DataType.UInt32>;
    dataSetOrdering: UAProperty<EnumDataSetOrdering, DataType.Int32>;
    networkMessageContentMask: UAProperty<UInt32, DataType.UInt32>;
    samplingOffset?: UAProperty<number, DataType.Double>;
    publishingOffset: UAProperty<number[], DataType.Double>;
}
export interface UAUadpWriterGroupMessage extends UAWriterGroupMessage, UAUadpWriterGroupMessage_Base {}