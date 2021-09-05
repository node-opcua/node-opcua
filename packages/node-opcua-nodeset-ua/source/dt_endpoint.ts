// ----- this file has been automatically generated - do not edit
import { Variant } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
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
  securityMode: Variant; // Variant ns=0;i=302
  securityPolicyUri: UAString; // String ns=0;i=12
  transportProfileUri: UAString; // String ns=0;i=12
}