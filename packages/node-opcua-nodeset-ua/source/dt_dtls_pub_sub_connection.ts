// ----- this file has been automatically generated - do not edit
import { NodeId } from "node-opcua-nodeid"
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |DtlsPubSubConnectionDataType                                |
 * | isAbstract|false                                                       |
 */
export interface DTDtlsPubSubConnection extends DTStructure {
  clientCipherSuite: UAString; // String ns=0;i=12
  serverCipherSuites: UAString[]; // String ns=0;i=12
  zeroRTT: boolean; // Boolean ns=0;i=1
  certificateGroupId: NodeId; // NodeId ns=0;i=17
  verifyClientCertificate: boolean; // Boolean ns=0;i=1
}
export interface UDTDtlsPubSubConnection extends ExtensionObject, DTDtlsPubSubConnection {};