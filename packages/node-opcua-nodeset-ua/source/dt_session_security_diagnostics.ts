// ----- this file has been automatically generated - do not edit
import { Variant } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |SessionSecurityDiagnosticsDataType                |
 * | isAbstract|false                                             |
 */
export interface DTSessionSecurityDiagnostics extends DTStructure  {
  sessionId: NodeId; // NodeId ns=0;i=17
  clientUserIdOfSession: UAString; // String ns=0;i=12
  clientUserIdHistory: UAString[]; // String ns=0;i=12
  authenticationMechanism: UAString; // String ns=0;i=12
  encoding: UAString; // String ns=0;i=12
  transportProtocol: UAString; // String ns=0;i=12
  securityMode: Variant; // Variant ns=0;i=302
  securityPolicyUri: UAString; // String ns=0;i=12
  clientCertificate: Buffer; // ByteString ns=0;i=15
}