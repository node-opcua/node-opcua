// ----- this file has been automatically generated - do not edit
import { Variant } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |UserTokenPolicy                                   |
 * | isAbstract|false                                             |
 */
export interface DTUserTokenPolicy extends DTStructure  {
  policyId: UAString; // String ns=0;i=12
  tokenType: Variant; // Variant ns=0;i=303
  issuedTokenType: UAString; // String ns=0;i=12
  issuerEndpointUrl: UAString; // String ns=0;i=12
  securityPolicyUri: UAString; // String ns=0;i=12
}