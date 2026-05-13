import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { Variant } from "node-opcua-variant";

import type { DTConnectionTransport } from "./dt_connection_transport";
import type { DTKeyValuePair } from "./dt_key_value_pair";
import type { DTNetworkAddress } from "./dt_network_address";
import type { DTReaderGroup } from "./dt_reader_group";
import type { DTStructure } from "./dt_structure";
import type { DTWriterGroup } from "./dt_writer_group";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |PubSubConnectionDataType                                    |
 * | isAbstract|false                                                       |
 */
export interface DTPubSubConnection extends DTStructure {
  name: UAString; // String ns=0;i=12
  enabled: boolean; // Boolean ns=0;i=1
  publisherId: Variant; // Variant ns=0;i=24
  transportProfileUri: UAString; // String ns=0;i=12
  address?: DTNetworkAddress; // ExtensionObject ns=0;i=15502
  connectionProperties: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
  transportSettings?: DTConnectionTransport; // ExtensionObject ns=0;i=15618
  writerGroups: DTWriterGroup[]; // ExtensionObject ns=0;i=15480
  readerGroups: DTReaderGroup[]; // ExtensionObject ns=0;i=15520
}
export interface UDTPubSubConnection extends ExtensionObject, DTPubSubConnection {};