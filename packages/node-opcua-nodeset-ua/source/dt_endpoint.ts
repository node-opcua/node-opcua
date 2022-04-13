// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
import { EnumMessageSecurityMode } from "./enum_message_security_mode"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |EndpointType                                      |
 * | isAbstract|false                                             |
 */
export interface DTEndpoint extends DTStructure  {
  endpointUrl: UAString; // String ns=0;i=12
  securityMode: EnumMessageSecurityMode; // Int32 ns=0;i=302
  securityPolicyUri: UAString; // String ns=0;i=12
  transportProfileUri: UAString; // String ns=0;i=12
}