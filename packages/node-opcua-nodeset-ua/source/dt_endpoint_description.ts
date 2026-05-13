import type { Byte, UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTApplicationDescription } from "./dt_application_description";
import type { DTStructure } from "./dt_structure";
import type { DTUserTokenPolicy } from "./dt_user_token_policy";
import type { EnumMessageSecurityMode } from "./enum_message_security_mode";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |EndpointDescription                                         |
 * | isAbstract|false                                                       |
 */
export interface DTEndpointDescription extends DTStructure {
  endpointUrl: UAString; // String ns=0;i=12
  server: DTApplicationDescription; // ExtensionObject ns=0;i=308
  serverCertificate: Buffer; // ByteString ns=0;i=311
  securityMode: EnumMessageSecurityMode; // Int32 ns=0;i=302
  securityPolicyUri: UAString; // String ns=0;i=12
  userIdentityTokens: DTUserTokenPolicy[]; // ExtensionObject ns=0;i=304
  transportProfileUri: UAString; // String ns=0;i=12
  securityLevel: Byte; // Byte ns=0;i=3
}
export interface UDTEndpointDescription extends ExtensionObject, DTEndpointDescription {};