// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
import { DTKeyValuePair } from "./dt_key_value_pair"
import { DTWriterGroup } from "./dt_writer_group"
import { DTReaderGroup } from "./dt_reader_group"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |PubSubConnectionDataType                          |
 * | isAbstract|false                                             |
 */
export interface DTPubSubConnection extends DTStructure  {
  name: UAString; // String ns=0;i=12
  enabled: boolean; // Boolean ns=0;i=1
  publisherId: undefined; // Null ns=0;i=0
  transportProfileUri: UAString; // String ns=0;i=12
  address: DTStructure; // ExtensionObject ns=0;i=22
  connectionProperties: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
  transportSettings: DTStructure; // ExtensionObject ns=0;i=22
  writerGroups: DTWriterGroup[]; // ExtensionObject ns=0;i=15480
  readerGroups: DTReaderGroup[]; // ExtensionObject ns=0;i=15520
}