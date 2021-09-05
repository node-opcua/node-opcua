// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, UInt16 } from "node-opcua-basic-types"
import { DTKeyValuePair } from "./dt_key_value_pair"
import { UADataSetWriterTransport } from "./ua_data_set_writer_transport"
import { UADataSetWriterMessage } from "./ua_data_set_writer_message"
import { UAPubSubStatus } from "./ua_pub_sub_status"
import { UAPubSubDiagnosticsDataSetWriter } from "./ua_pub_sub_diagnostics_data_set_writer"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |DataSetWriterType ns=0;i=15298                    |
 * |isAbstract      |false                                             |
 */
export interface UADataSetWriter_Base {
    dataSetWriterId: UAProperty<UInt16, /*z*/DataType.UInt16>;
    dataSetFieldContentMask: UAProperty<UInt32, /*z*/DataType.UInt32>;
    keyFrameCount?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    dataSetWriterProperties: UAProperty<DTKeyValuePair[], /*z*/DataType.ExtensionObject>;
    transportSettings?: UADataSetWriterTransport;
    messageSettings?: UADataSetWriterMessage;
    status: UAPubSubStatus;
    diagnostics?: UAPubSubDiagnosticsDataSetWriter;
}
export interface UADataSetWriter extends UAObject, UADataSetWriter_Base {
}