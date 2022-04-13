// ----- this file has been automatically generated - do not edit
import { Byte, UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
import { DTApplicationDescription } from "./dt_application_description"
import { EnumMessageSecurityMode } from "./enum_message_security_mode"
import { DTUserTokenPolicy } from "./dt_user_token_policy"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |EndpointDescription                               |
 * | isAbstract|false                                             |
 */
export interface DTEndpointDescription extends DTStructure  {
  endpointUrl: UAString; // String ns=0;i=12
  server: DTApplicationDescription; // ExtensionObject ns=0;i=308
  serverCertificate: Buffer; // ByteString ns=0;i=311
  securityMode: EnumMessageSecurityMode; // Int32 ns=0;i=302
  securityPolicyUri: UAString; // String ns=0;i=12
  userIdentityTokens: DTUserTokenPolicy[]; // ExtensionObject ns=0;i=304
  transportProfileUri: UAString; // String ns=0;i=12
  securityLevel: Byte; // Byte ns=0;i=3
}