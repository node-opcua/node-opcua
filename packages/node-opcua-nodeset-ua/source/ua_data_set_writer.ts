import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UInt16, UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { DTKeyValuePair } from "./dt_key_value_pair";
import type { UADataSetWriterMessage } from "./ua_data_set_writer_message";
import type { UADataSetWriterTransport } from "./ua_data_set_writer_transport";
import type { UAPubSubDiagnosticsDataSetWriter } from "./ua_pub_sub_diagnostics_data_set_writer";
import type { UAPubSubStatus } from "./ua_pub_sub_status";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |DataSetWriterType i=15298                                   |
 * |isAbstract      |false                                                       |
 */
export interface UADataSetWriter_Base {
    dataSetWriterId: UAProperty<UInt16, DataType.UInt16>;
    dataSetFieldContentMask: UAProperty<UInt32, DataType.UInt32>;
    keyFrameCount?: UAProperty<UInt32, DataType.UInt32>;
    dataSetWriterProperties: UAProperty<DTKeyValuePair[], DataType.ExtensionObject>;
    transportSettings?: UADataSetWriterTransport;
    messageSettings?: UADataSetWriterMessage;
    status: UAPubSubStatus;
    diagnostics?: UAPubSubDiagnosticsDataSetWriter;
}
export interface UADataSetWriter extends UAObject, UADataSetWriter_Base {}