// ----- this file has been automatically generated - do not edit
import { Int32 } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |EndpointConfiguration                             |
 * | isAbstract|false                                             |
 */
export interface DTEndpointConfiguration extends DTStructure  {
  operationTimeout: Int32; // Int32 ns=0;i=6
  useBinaryEncoding: boolean; // Boolean ns=0;i=1
  maxStringLength: Int32; // Int32 ns=0;i=6
  maxByteStringLength: Int32; // Int32 ns=0;i=6
  maxArrayLength: Int32; // Int32 ns=0;i=6
  maxMessageSize: Int32; // Int32 ns=0;i=6
  maxBufferSize: Int32; // Int32 ns=0;i=6
  channelLifetime: Int32; // Int32 ns=0;i=6
  securityTokenLifetime: Int32; // Int32 ns=0;i=6
}