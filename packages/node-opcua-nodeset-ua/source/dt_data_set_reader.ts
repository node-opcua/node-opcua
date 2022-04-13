// ----- this file has been automatically generated - do not edit
import { UInt32, UInt16, UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
import { DTDataSetMeta } from "./dt_data_set_meta"
import { EnumMessageSecurityMode } from "./enum_message_security_mode"
import { DTEndpointDescription } from "./dt_endpoint_description"
import { DTKeyValuePair } from "./dt_key_value_pair"
import { DTDataSetReaderTransport } from "./dt_data_set_reader_transport"
import { DTDataSetReaderMessage } from "./dt_data_set_reader_message"
import { DTSubscribedDataSet } from "./dt_subscribed_data_set"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |DataSetReaderDataType                             |
 * | isAbstract|false                                             |
 */
export interface DTDataSetReader extends DTStructure  {
  name: UAString; // String ns=0;i=12
  enabled: boolean; // Boolean ns=0;i=1
  publisherId: undefined; // Null ns=0;i=0
  writerGroupId: UInt16; // UInt16 ns=0;i=5
  dataSetWriterId: UInt16; // UInt16 ns=0;i=5
  dataSetMetaData: DTDataSetMeta; // ExtensionObject ns=0;i=14523
  dataSetFieldContentMask: UInt32; // UInt32 ns=0;i=15583
  messageReceiveTimeout: number; // Double ns=0;i=290
  keyFrameCount: UInt32; // UInt32 ns=0;i=7
  headerLayoutUri: UAString; // String ns=0;i=12
  securityMode: EnumMessageSecurityMode; // Int32 ns=0;i=302
  securityGroupId: UAString; // String ns=0;i=12
  securityKeyServices: DTEndpointDescription[]; // ExtensionObject ns=0;i=312
  dataSetReaderProperties: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
  transportSettings: DTDataSetReaderTransport; // ExtensionObject ns=0;i=15628
  messageSettings: DTDataSetReaderMessage; // ExtensionObject ns=0;i=15629
  subscribedDataSet: DTSubscribedDataSet; // ExtensionObject ns=0;i=15630
}