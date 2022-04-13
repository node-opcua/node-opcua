// ----- this file has been automatically generated - do not edit
import { UInt32, UInt16, Byte, UAString } from "node-opcua-basic-types"
import { DTPubSubGroup } from "./dt_pub_sub_group"
import { EnumMessageSecurityMode } from "./enum_message_security_mode"
import { DTEndpointDescription } from "./dt_endpoint_description"
import { DTKeyValuePair } from "./dt_key_value_pair"
import { DTWriterGroupTransport } from "./dt_writer_group_transport"
import { DTWriterGroupMessage } from "./dt_writer_group_message"
import { DTDataSetWriter } from "./dt_data_set_writer"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |WriterGroupDataType                               |
 * | isAbstract|false                                             |
 */
export interface DTWriterGroup extends DTPubSubGroup  {
  name: UAString; // String ns=0;i=12
  enabled: boolean; // Boolean ns=0;i=1
  securityMode: EnumMessageSecurityMode; // Int32 ns=0;i=302
  securityGroupId: UAString; // String ns=0;i=12
  securityKeyServices: DTEndpointDescription[]; // ExtensionObject ns=0;i=312
  maxNetworkMessageSize: UInt32; // UInt32 ns=0;i=7
  groupProperties: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
  writerGroupId: UInt16; // UInt16 ns=0;i=5
  publishingInterval: number; // Double ns=0;i=290
  keepAliveTime: number; // Double ns=0;i=290
  priority: Byte; // Byte ns=0;i=3
  localeIds: UAString[]; // String ns=0;i=295
  headerLayoutUri: UAString; // String ns=0;i=12
  transportSettings: DTWriterGroupTransport; // ExtensionObject ns=0;i=15611
  messageSettings: DTWriterGroupMessage; // ExtensionObject ns=0;i=15616
  dataSetWriters: DTDataSetWriter[]; // ExtensionObject ns=0;i=15597
}