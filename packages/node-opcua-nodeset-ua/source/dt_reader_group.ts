import type { UAString, UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTDataSetReader } from "./dt_data_set_reader";
import type { DTEndpointDescription } from "./dt_endpoint_description";
import type { DTKeyValuePair } from "./dt_key_value_pair";
import type { DTPubSubGroup } from "./dt_pub_sub_group";
import type { DTReaderGroupMessage } from "./dt_reader_group_message";
import type { DTReaderGroupTransport } from "./dt_reader_group_transport";
import type { EnumMessageSecurityMode } from "./enum_message_security_mode";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |ReaderGroupDataType                                         |
 * | isAbstract|false                                                       |
 */
export interface DTReaderGroup extends DTPubSubGroup {
  name: UAString; // String ns=0;i=12
  enabled: boolean; // Boolean ns=0;i=1
  securityMode: EnumMessageSecurityMode; // Int32 ns=0;i=302
  securityGroupId: UAString; // String ns=0;i=12
  securityKeyServices: DTEndpointDescription[]; // ExtensionObject ns=0;i=312
  maxNetworkMessageSize: UInt32; // UInt32 ns=0;i=7
  groupProperties: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
  transportSettings?: DTReaderGroupTransport; // ExtensionObject ns=0;i=15621
  messageSettings?: DTReaderGroupMessage; // ExtensionObject ns=0;i=15622
  dataSetReaders: DTDataSetReader[]; // ExtensionObject ns=0;i=15623
}
export interface UDTReaderGroup extends ExtensionObject, DTReaderGroup {};