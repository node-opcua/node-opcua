// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UAWriterGroupMessage, UAWriterGroupMessage_Base } from "./ua_writer_group_message"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |JsonWriterGroupMessageType ns=0;i=21126           |
 * |isAbstract      |false                                             |
 */
export interface UAJsonWriterGroupMessage_Base extends UAWriterGroupMessage_Base {
    networkMessageContentMask: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAJsonWriterGroupMessage extends UAWriterGroupMessage, UAJsonWriterGroupMessage_Base {
}